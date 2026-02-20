/* ============================================
   App - Main Orchestrator
   ============================================ */

console.log('📦 app.js loaded');

const App = {
    state: {
        currentImage: null,
        currentResult: null,
        mode: 'single', // 'single' or 'batch'
        settings: {
            colorCount: 14,
            complexity: 'high',
            minRegionSize: 100,
            lineWidth: 1.5,
            lineOpacity: 1.0,
            showNumbers: true,
            numberSize: 12,
            numberOpacity: 1.0,
            showColors: false,
            backgroundColor: '#ffffff',
            geometricStyle: false,
            maxSize: 1024
        },
        batchProcessor: new BatchProcessor()
    },

    // Preset configurations
    presets: {
        kids: { colorCount: 6, complexity: 'low', minRegionSize: 200, lineWidth: 3, numberSize: 16 },
        teens: { colorCount: 10, complexity: 'medium', minRegionSize: 150, lineWidth: 2, numberSize: 14 },
        adults: { colorCount: 14, complexity: 'high', minRegionSize: 100, lineWidth: 1.5, numberSize: 12 },
        expert: { colorCount: 16, complexity: 'extreme', minRegionSize: 50, lineWidth: 1, numberSize: 10 }
    },

    /**
     * Initialize application
     */
    init() {
        console.log('🎨 Watershed PBN Generator - Initializing...');
        console.log('📍 Current mode:', this.state.mode);
        console.log('⚙️  Settings:', this.state.settings);

        this.bindEvents();
        this.updateUI();
        this.waitForOpenCV();

        console.log('✅ App initialized, waiting for OpenCV...');
    },

    /**
     * Wait for OpenCV to load
     */
    waitForOpenCV() {
        if (typeof cv !== 'undefined' && cv.Mat) {
            this.onOpenCVReady();
        } else {
            window.addEventListener('opencv-ready', () => this.onOpenCVReady());
        }
    },

    /**
     * OpenCV ready callback
     */
    onOpenCVReady() {
        console.log('App: OpenCV is ready');
        document.getElementById('generateBtn').disabled = this.state.currentImage === null;
    },

    /**
     * Bind UI event listeners
     */
    bindEvents() {
        // File input
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');

        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));

        // Drag & drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileSelect(e.dataTransfer.files);
        });

        // Mode toggle
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
        });

        // Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.applyPreset(e.target.dataset.preset));
        });

        // Settings
        document.getElementById('colorCountSlider').addEventListener('input', (e) => {
            this.state.settings.colorCount = parseInt(e.target.value);
            document.getElementById('colorCountValue').textContent = e.target.value;
        });

        document.getElementById('complexitySelect').addEventListener('change', (e) => {
            this.state.settings.complexity = e.target.value;
        });

        document.getElementById('minRegionSlider').addEventListener('input', (e) => {
            this.state.settings.minRegionSize = parseInt(e.target.value);
            document.getElementById('minRegionValue').textContent = e.target.value + ' px';
        });

        document.getElementById('lineWidthSlider').addEventListener('input', (e) => {
            this.state.settings.lineWidth = parseFloat(e.target.value);
            document.getElementById('lineWidthValue').textContent = e.target.value + ' px';
        });

        document.getElementById('numberSizeSlider').addEventListener('input', (e) => {
            this.state.settings.numberSize = parseInt(e.target.value);
            document.getElementById('numberSizeValue').textContent = e.target.value + ' pt';
        });

        document.getElementById('showNumbersCheck').addEventListener('change', (e) => {
            this.state.settings.showNumbers = e.target.checked;
        });

        document.getElementById('showColorsCheck').addEventListener('change', (e) => {
            this.state.settings.showColors = e.target.checked;
        });

        document.getElementById('bgColorInput').addEventListener('input', (e) => {
            this.state.settings.backgroundColor = e.target.value;
            document.getElementById('bgColorValue').textContent = e.target.value;
        });

        document.getElementById('lineOpacitySlider').addEventListener('input', (e) => {
            this.state.settings.lineOpacity = parseFloat(e.target.value);
            document.getElementById('lineOpacityValue').textContent = Math.round(e.target.value * 100) + '%';
        });

        document.getElementById('numberOpacitySlider').addEventListener('input', (e) => {
            this.state.settings.numberOpacity = parseFloat(e.target.value);
            document.getElementById('numberOpacityValue').textContent = Math.round(e.target.value * 100) + '%';
        });

        document.getElementById('geometricStyleCheck').addEventListener('change', (e) => {
            this.state.settings.geometricStyle = e.target.checked;
        });

        // Actions
        document.getElementById('generateBtn').addEventListener('click', () => this.generate());
        document.getElementById('downloadSvgBtn').addEventListener('click', () => this.downloadSVG());
        document.getElementById('downloadPngBtn').addEventListener('click', () => this.downloadPNG());
        document.getElementById('downloadLegendBtn').addEventListener('click', () => this.downloadLegend());
        document.getElementById('downloadAllBtn').addEventListener('click', () => this.downloadAll());
        document.getElementById('downloadCleanBtn').addEventListener('click', () => this.downloadClean());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('removeImageBtn').addEventListener('click', () => this.removeImage());

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Batch mode
        document.getElementById('clearBatchBtn').addEventListener('click', () => this.clearBatch());
        document.getElementById('processBatchBtn').addEventListener('click', () => this.processBatch());
        document.getElementById('batchFileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
            e.target.value = ''; // Reset so same files can be re-added
        });
    },

    /**
     * Handle file selection
     */
    async handleFileSelect(files) {
        if (files.length === 0) return;

        if (this.state.mode === 'single') {
            const file = files[0];

            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                Utils.showToast(`File too large (${Utils.formatFileSize(file.size)}). Max 10MB allowed.`, 'error');
                return;
            }

            try {
                const image = await Utils.loadImageFromFile(file);
                this.state.currentImage = image;
                this.displayOriginalImage(image);
                document.getElementById('generateBtn').disabled = false;
                Utils.showToast('Image loaded successfully', 'success');
            } catch (error) {
                Utils.showToast('Error loading image', 'error');
                console.error(error);
            }
        } else {
            // Batch mode
            this.state.batchProcessor.addFiles(files);
            this.updateBatchList();
        }
    },

    /**
     * Display original image
     */
    displayOriginalImage(image) {
        const preview = document.getElementById('originalImage');
        const container = document.getElementById('imagePreviewContainer');
        const placeholder = document.getElementById('uploadPlaceholder');

        preview.src = image.src;
        container.hidden = false;
        placeholder.hidden = true;
    },

    /**
     * Remove current image
     */
    removeImage() {
        this.state.currentImage = null;
        this.state.currentResult = null;

        document.getElementById('imagePreviewContainer').hidden = true;
        document.getElementById('uploadPlaceholder').hidden = false;
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('fileInput').value = '';

        this.clearCanvas();
    },

    /**
     * Switch mode (single/batch)
     */
    switchMode(mode) {
        this.state.mode = mode;

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update file input for batch mode
        const fileInput = document.getElementById('fileInput');
        fileInput.multiple = mode === 'batch';

        if (mode === 'batch') {
            document.getElementById('imagePreviewContainer').hidden = true;
            const hasItems = this.state.batchProcessor.queue.length > 0;
            document.getElementById('batchListContainer').hidden = !hasItems;
            document.getElementById('uploadPlaceholder').hidden = hasItems;
        } else {
            document.getElementById('batchListContainer').hidden = true;
            const hasImage = this.state.currentImage !== null;
            document.getElementById('imagePreviewContainer').hidden = !hasImage;
            document.getElementById('uploadPlaceholder').hidden = hasImage;
        }
    },

    /**
     * Apply preset
     */
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;

        Object.assign(this.state.settings, preset);

        // Update UI
        document.getElementById('colorCountSlider').value = preset.colorCount;
        document.getElementById('colorCountValue').textContent = preset.colorCount;
        document.getElementById('complexitySelect').value = preset.complexity;
        document.getElementById('minRegionSlider').value = preset.minRegionSize;
        document.getElementById('minRegionValue').textContent = preset.minRegionSize + ' px';
        document.getElementById('lineWidthSlider').value = preset.lineWidth;
        document.getElementById('lineWidthValue').textContent = preset.lineWidth + ' px';
        document.getElementById('numberSizeSlider').value = preset.numberSize;
        document.getElementById('numberSizeValue').textContent = preset.numberSize + ' pt';

        // Reset opacity and geometric style on preset change
        this.state.settings.lineOpacity = 1.0;
        this.state.settings.numberOpacity = 1.0;
        this.state.settings.geometricStyle = false;
        document.getElementById('lineOpacitySlider').value = 1;
        document.getElementById('lineOpacityValue').textContent = '100%';
        document.getElementById('numberOpacitySlider').value = 1;
        document.getElementById('numberOpacityValue').textContent = '100%';
        document.getElementById('geometricStyleCheck').checked = false;

        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.preset === presetName);
        });

        Utils.showToast(`Applied ${presetName} preset`, 'info', 2000);
    },

    /**
     * Generate paint-by-numbers
     */
    async generate() {
        if (!this.state.currentImage) return;

        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        const loadingSubtext = document.getElementById('loadingSubtext');
        const progressBar = document.getElementById('progressBar');

        try {
            loadingOverlay.hidden = false;

            const processor = new WatershedProcessor();
            const imageData = Utils.getImageData(this.state.currentImage, this.state.settings.maxSize);

            const result = await processor.process(
                imageData,
                this.state.settings,
                (progress) => {
                    progressBar.style.width = progress.percent + '%';
                    loadingSubtext.textContent = progress.message;
                }
            );

            this.state.currentResult = result;

            console.log('📊 Processing result:', {
                regions: result.regions.length,
                palette: result.palette.length,
                width: result.width,
                height: result.height
            });

            if (result.regions.length === 0) {
                console.warn('⚠️ No regions found! Check marker creation and watershed.');
                loadingOverlay.hidden = true;
                Utils.showToast('No regions detected. Try different settings or a different image.', 'warning', 5000);
                return;
            }

            // Generate SVG
            console.log('🖼️ Generating SVG...');
            const svgGen = new SVGGenerator();
            const svg = svgGen.generateSVG(result.regions, result.palette, {
                ...this.state.settings,
                smoothPaths: !this.state.settings.geometricStyle,
                width: result.width,
                height: result.height
            });
            console.log('✅ SVG generated, length:', svg.length);

            // Generate legend
            const legend = svgGen.generateLegend(result.palette);
            console.log('✅ Legend generated, length:', legend.length);

            // Display result
            this.displayResult(svg, legend);
            console.log('✅ Display result called');

            // Enable download buttons
            document.getElementById('downloadSvgBtn').disabled = false;
            document.getElementById('downloadPngBtn').disabled = false;
            document.getElementById('downloadLegendBtn').disabled = false;
            document.getElementById('downloadAllBtn').disabled = false;
            document.getElementById('downloadCleanBtn').disabled = false;

            Utils.showToast('Paint-by-numbers generated successfully!', 'success');

        } catch (error) {
            console.error('Generation error:', error);
            Utils.showToast('Error generating paint-by-numbers', 'error');
        } finally {
            loadingOverlay.hidden = true;
        }
    },

    /**
     * Display result
     */
    displayResult(svg, legend) {
        console.log('🖥️ displayResult called');
        const canvas = document.getElementById('previewCanvas');
        const ctx = canvas.getContext('2d');

        // Convert SVG to image
        const img = new Image();
        img.onload = () => {
            console.log('✅ SVG image loaded:', img.width, 'x', img.height);
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(img.src);
            console.log('✅ Canvas updated!');
        };
        img.onerror = (error) => {
            console.error('❌ SVG rendering error:', error);
            Utils.showToast('Error rendering SVG preview', 'error');
        };

        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        console.log('🔗 SVG blob URL created:', url);
        img.src = url;

        // Store for downloads
        this.state.currentResult.svg = svg;
        this.state.currentResult.legend = legend;

        // Show canvas placeholder
        document.getElementById('canvasPlaceholder').hidden = true;

        // Display legend
        const legendContainer = document.getElementById('legendContainer');
        legendContainer.innerHTML = '';
        const legendImg = new Image();
        legendImg.onload = () => {
            legendContainer.appendChild(legendImg);
            URL.revokeObjectURL(legendImg.src); // Clean up
        };
        legendImg.onerror = (error) => {
            console.error('Legend rendering error:', error);
        };
        const legendBlob = new Blob([legend], { type: 'image/svg+xml' });
        legendImg.src = URL.createObjectURL(legendBlob);

        // Switch to result tab
        this.switchTab('result');
    },

    /**
     * Switch tab
     */
    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        document.getElementById('previewCanvas').hidden = tab !== 'result';
        document.getElementById('originalCanvas').hidden = tab !== 'original';
        document.getElementById('legendContainer').hidden = tab !== 'legend';

        if (tab === 'original' && this.state.currentImage) {
            const canvas = document.getElementById('originalCanvas');
            const ctx = canvas.getContext('2d');
            canvas.width = this.state.currentImage.width;
            canvas.height = this.state.currentImage.height;
            ctx.drawImage(this.state.currentImage, 0, 0);
        }
    },

    /**
     * Download SVG
     */
    downloadSVG() {
        if (!this.state.currentResult || !this.state.currentResult.svg) return;
        Utils.downloadSvg(this.state.currentResult.svg, 'paint-by-numbers.svg');
    },

    /**
     * Download PNG
     */
    downloadPNG() {
        if (!this.state.currentResult) return;
        const canvas = document.getElementById('previewCanvas');
        Utils.downloadCanvas(canvas, 'paint-by-numbers.png');
    },

    /**
     * Download legend
     */
    downloadLegend() {
        if (!this.state.currentResult || !this.state.currentResult.legend) return;
        Utils.downloadSvg(this.state.currentResult.legend, 'color-legend.svg');
    },

    /**
     * Download Clean - outlines only, no numbers, no legend
     */
    async downloadClean() {
        if (!this.state.currentResult) return;

        const result = this.state.currentResult;
        const svgGen = new SVGGenerator();
        const cleanSvg = svgGen.generateSVG(result.regions, result.palette, {
            ...this.state.settings,
            smoothPaths: !this.state.settings.geometricStyle,
            showNumbers: false,
            width: result.width,
            height: result.height
        });

        const img = await this.svgToImage(cleanSvg);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        Utils.downloadCanvas(canvas, 'paint-by-numbers-clean.png');
        Utils.showToast('Downloaded clean painting template!', 'success');
    },

    /**
     * Render combined PNG: PBN on top, legend (left) + original thumbnail (right) below.
     * Returns a canvas element.
     * @param {HTMLImageElement|HTMLCanvasElement} pbnSource - PBN image or canvas
     * @param {HTMLImageElement} legendImg - rendered legend image
     * @param {HTMLImageElement} originalImg - original photo for thumbnail
     * @param {number} targetWidth - total width of the combined image
     */
    renderCombinedPNG(pbnSource, legendImg, originalImg, targetWidth) {
        const pbnHeight = Math.round(pbnSource.height * (targetWidth / pbnSource.width));
        const spacing = 24;
        const gap = 12;

        // Bottom section: legend left (~70%), original thumbnail right (~30%)
        const legendWidth = Math.round(targetWidth * 0.7 - gap / 2);
        const thumbWidth = Math.round(targetWidth * 0.3 - gap / 2);

        // Scale legend to fit left column
        const legendScale = legendWidth / legendImg.width;
        const legendHeight = Math.round(legendImg.height * legendScale);

        // Scale original proportionally to fit thumb column
        const thumbScale = Math.min(thumbWidth / originalImg.width, 1);
        const thumbH = Math.round(originalImg.height * thumbScale);
        const thumbW = Math.round(originalImg.width * thumbScale);

        // Bottom row height = max of legend and thumbnail
        const bottomHeight = Math.max(legendHeight, thumbH);
        const totalHeight = pbnHeight + spacing + bottomHeight;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, totalHeight);

        // Draw PBN on top
        ctx.drawImage(pbnSource, 0, 0, targetWidth, pbnHeight);

        // Draw legend bottom-left
        ctx.drawImage(legendImg, 0, pbnHeight + spacing, legendWidth, legendHeight);

        // Draw original thumbnail bottom-right, vertically centered
        const thumbX = legendWidth + gap;
        const thumbY = pbnHeight + spacing + Math.round((bottomHeight - thumbH) / 2);
        ctx.drawImage(originalImg, thumbX, thumbY, thumbW, thumbH);

        return canvas;
    },

    /**
     * Download All - Combined PNG (110% width) with legend + original thumbnail below
     */
    async downloadAll() {
        if (!this.state.currentResult || !this.state.currentResult.svg) return;

        const result = this.state.currentResult;
        const pbnCanvas = document.getElementById('previewCanvas');
        const targetWidth = Math.round(result.width * 1.1);

        const legendImg = await this.svgToImage(result.legend);
        const combinedCanvas = this.renderCombinedPNG(pbnCanvas, legendImg, this.state.currentImage, targetWidth);

        Utils.downloadCanvas(combinedCanvas, 'paint-by-numbers-complete.png');
        Utils.showToast('Downloaded PNG + Legend!', 'success');
    },

    /**
     * Convert SVG string to Image element
     */
    svgToImage(svgString) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                resolve(img);
            };
            img.onerror = reject;
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            img.src = URL.createObjectURL(blob);
        });
    },

    /**
     * Reset
     */
    reset() {
        this.removeImage();
        this.applyPreset('adults');
        this.switchTab('result');
    },

    /**
     * Clear canvas
     */
    clearCanvas() {
        const canvas = document.getElementById('previewCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.getElementById('canvasPlaceholder').hidden = false;

        document.getElementById('downloadSvgBtn').disabled = true;
        document.getElementById('downloadPngBtn').disabled = true;
        document.getElementById('downloadLegendBtn').disabled = true;
        document.getElementById('downloadCleanBtn').disabled = true;
    },

    /**
     * Update batch list UI
     */
    updateBatchList() {
        const list = document.getElementById('batchList');
        const count = document.getElementById('batchCount');
        const processBtn = document.getElementById('processBatchBtn');

        list.innerHTML = '';
        const items = this.state.batchProcessor.queue;

        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'batch-item';
            div.innerHTML = `
                <div class="batch-item-info">
                    <div class="batch-item-name">${item.file.name}</div>
                    <div class="batch-item-size">${Utils.formatFileSize(item.file.size)}</div>
                </div>
                <span class="batch-item-status ${item.status}">${item.status}</span>
                <button class="batch-item-remove" onclick="App.removeBatchItem(${index})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            `;
            list.appendChild(div);
        });

        count.textContent = items.length;
        processBtn.disabled = items.length === 0;

        // Toggle placeholder vs batch list visibility
        if (this.state.mode === 'batch') {
            const hasItems = items.length > 0;
            document.getElementById('batchListContainer').hidden = !hasItems;
            document.getElementById('uploadPlaceholder').hidden = hasItems;
        }
    },

    /**
     * Remove batch item
     */
    removeBatchItem(index) {
        this.state.batchProcessor.removeItem(index);
        this.updateBatchList();
    },

    /**
     * Clear batch
     */
    clearBatch() {
        this.state.batchProcessor.clear();
        this.updateBatchList();
    },

    /**
     * Process batch - processes each image one by one,
     * downloads combined PNG+Legend for each, then continues.
     */
    async processBatch() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        const loadingSubtext = document.getElementById('loadingSubtext');
        const progressBar = document.getElementById('progressBar');
        const queue = this.state.batchProcessor.queue;

        if (queue.length === 0) return;

        loadingOverlay.hidden = false;
        let completed = 0;
        let errors = 0;

        const processor = new WatershedProcessor();
        const svgGen = new SVGGenerator();

        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            const baseName = item.file.name.replace(/\.[^.]+$/, '');

            try {
                item.status = 'processing';
                this.updateBatchList();
                loadingText.textContent = `Processing ${i + 1} / ${queue.length}: ${item.file.name}`;
                loadingSubtext.textContent = 'Loading image...';
                progressBar.style.width = '0%';

                // Load and process image
                const image = await Utils.loadImageFromFile(item.file);
                const imageData = Utils.getImageData(image, this.state.settings.maxSize);

                const result = await processor.process(
                    imageData,
                    this.state.settings,
                    (progress) => {
                        progressBar.style.width = progress.percent + '%';
                        loadingSubtext.textContent = progress.message;
                    }
                );

                if (result.regions.length === 0) {
                    item.status = 'error';
                    item.error = 'No regions detected';
                    errors++;
                    this.updateBatchList();
                    continue;
                }

                // Generate SVG + Legend
                const svg = svgGen.generateSVG(result.regions, result.palette, {
                    ...this.state.settings,
                    smoothPaths: !this.state.settings.geometricStyle,
                    width: result.width,
                    height: result.height
                });
                const legend = svgGen.generateLegend(result.palette);

                // Render combined PNG (PBN + Legend) like downloadAll
                loadingSubtext.textContent = 'Rendering PNG...';
                const pbnImg = await this.svgToImage(svg);
                const legendImg = await this.svgToImage(legend);

                const targetWidth = Math.round(result.width * 1.1);
                const combinedCanvas = this.renderCombinedPNG(pbnImg, legendImg, image, targetWidth);

                // Download this image
                loadingSubtext.textContent = 'Downloading...';
                Utils.downloadCanvas(combinedCanvas, `${baseName}_pbn.png`);

                // Small delay between downloads so browser doesn't block them
                await new Promise(r => setTimeout(r, 800));

                item.status = 'completed';
                completed++;
                this.updateBatchList();

            } catch (error) {
                console.error(`Error processing ${item.file.name}:`, error);
                item.status = 'error';
                item.error = error.message;
                errors++;
                this.updateBatchList();
            }
        }

        loadingOverlay.hidden = true;

        if (errors === 0) {
            Utils.showToast(`Batch complete! ${completed} images downloaded.`, 'success', 5000);
        } else {
            Utils.showToast(`Done: ${completed} downloaded, ${errors} failed.`, 'warning', 5000);
        }
    },

    /**
     * Update UI state
     */
    updateUI() {
        // Initial state
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
