/* ============================================
   Batch Processor - Multi-Image Processing
   ============================================ */

class BatchProcessor {
    constructor() {
        this.queue = [];
        this.results = [];
        this.isProcessing = false;
        this.currentIndex = 0;
    }

    /**
     * Add files to batch queue
     * @param {FileList} files
     */
    addFiles(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                this.queue.push({
                    file,
                    status: 'pending',
                    result: null,
                    error: null
                });
            }
        });
    }

    /**
     * Process all images in batch
     * @param {Object} options - Processing options
     * @param {Function} onItemComplete - Callback for each item
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Array>}
     */
    async processBatch(options, onItemComplete, onProgress) {
        if (this.isProcessing) {
            throw new Error('Batch processing already in progress');
        }

        this.isProcessing = true;
        this.currentIndex = 0;
        this.results = [];

        const processor = new WatershedProcessor();
        const svgGen = new SVGGenerator();

        for (let i = 0; i < this.queue.length; i++) {
            const item = this.queue[i];

            try {
                item.status = 'processing';
                onItemComplete && onItemComplete(item, i);

                // Load image
                const image = await Utils.loadImageFromFile(item.file);
                const imageData = Utils.getImageData(image, options.maxSize);

                // Process with watershed
                const result = await processor.process(
                    imageData,
                    options,
                    (progress) => {
                        onProgress && onProgress({
                            item: i,
                            total: this.queue.length,
                            ...progress
                        });
                    }
                );

                // Generate SVG
                const svg = svgGen.generateSVG(result.regions, result.palette, {
                    width: result.width,
                    height: result.height,
                    showNumbers: options.showNumbers,
                    numberSize: options.numberSize,
                    lineWidth: options.lineWidth,
                    showColors: options.showColors,
                    backgroundColor: options.backgroundColor
                });

                // Generate legend
                const legend = svgGen.generateLegend(result.palette);

                item.status = 'completed';
                item.result = {
                    svg,
                    legend,
                    palette: result.palette,
                    width: result.width,
                    height: result.height
                };

                this.results.push(item);
                onItemComplete && onItemComplete(item, i);

            } catch (error) {
                console.error(`Error processing ${item.file.name}:`, error);
                item.status = 'error';
                item.error = error.message;
                onItemComplete && onItemComplete(item, i);
            }

            this.currentIndex = i + 1;
        }

        this.isProcessing = false;
        return this.results;
    }

    /**
     * Download batch results as ZIP
     * @param {string} zipName
     * @returns {Promise<void>}
     */
    async downloadAsZip(zipName = 'pbn-batch-export.zip') {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded');
        }

        const zip = new JSZip();

        this.results.forEach((item, index) => {
            if (item.status === 'completed' && item.result) {
                const baseName = item.file.name.replace(/\.[^.]+$/, '');

                // Add SVG
                zip.file(`${baseName}_pbn.svg`, item.result.svg);

                // Add legend
                zip.file(`${baseName}_legend.svg`, item.result.legend);
            }
        });

        const blob = await zip.generateAsync({ type: 'blob' });

        // Download
        if (typeof saveAs !== 'undefined') {
            saveAs(blob, zipName);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = zipName;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    /**
     * Clear batch queue
     */
    clear() {
        if (this.isProcessing) {
            throw new Error('Cannot clear queue while processing');
        }
        this.queue = [];
        this.results = [];
        this.currentIndex = 0;
    }

    /**
     * Remove item from queue
     * @param {number} index
     */
    removeItem(index) {
        if (this.isProcessing) {
            throw new Error('Cannot remove item while processing');
        }
        this.queue.splice(index, 1);
    }

    /**
     * Get queue status
     * @returns {Object}
     */
    getStatus() {
        return {
            total: this.queue.length,
            completed: this.queue.filter(i => i.status === 'completed').length,
            processing: this.queue.filter(i => i.status === 'processing').length,
            pending: this.queue.filter(i => i.status === 'pending').length,
            errors: this.queue.filter(i => i.status === 'error').length,
            isProcessing: this.isProcessing,
            currentIndex: this.currentIndex
        };
    }
}
