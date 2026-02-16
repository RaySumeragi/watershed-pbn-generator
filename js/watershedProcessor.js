/* ============================================
   Watershed Processor - Core Algorithm
   ============================================ */

class WatershedProcessor {
    constructor() {
        this.quantizer = new ColorQuantizer();
        this.currentStep = 0;
        this.totalSteps = 5;
    }

    /**
     * Main processing pipeline
     * @param {ImageData} imageData - Source image
     * @param {Object} options - Processing options
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} Processing result
     */
    async process(imageData, options, onProgress = null) {
        // Check if OpenCV is loaded
        if (typeof cv === 'undefined' || !cv.Mat) {
            throw new Error('OpenCV.js is not loaded. Please wait for it to load.');
        }

        const {
            colorCount = 14,
            complexity = 'high',
            minRegionSize = 100,
            maxSize = 1024
        } = options;

        try {
            this.updateProgress(onProgress, 0, 'Preprocessing image...');

            // Step 1: Preprocess image
            let preprocessed;
            try {
                preprocessed = await this.preprocessImage(imageData, maxSize);
                console.log('Preprocessing done:', preprocessed.width, 'x', preprocessed.height);
            } catch (e) {
                console.error('Preprocessing failed:', e);
                throw new Error('Image preprocessing failed: ' + e);
            }

            this.updateProgress(onProgress, 20, 'Quantizing colors...');

            // Step 2: Color quantization (K-Means in Lab space)
            let quantized, palette, labels;
            try {
                const result = this.quantizer.quantize(preprocessed, colorCount);
                quantized = result.quantized;
                palette = result.palette;
                labels = result.labels;
                console.log('Color quantization done:', palette.length, 'colors');
            } catch (e) {
                console.error('Color quantization failed:', e);
                throw new Error('Color quantization failed: ' + e);
            }

            this.updateProgress(onProgress, 40, 'Creating markers...');

            // Step 3: Create watershed markers from quantized color labels
            let markers;
            try {
                markers = this.createMarkers(quantized, labels, colorCount, complexity);
                console.log('Markers created');
            } catch (e) {
                console.error('Marker creation failed:', e);
                quantized.delete();
                labels.delete();
                throw new Error('Marker creation failed: ' + e);
            }

            this.updateProgress(onProgress, 60, 'Applying watershed...');

            // Step 4: Apply watershed algorithm
            let watershedMap;
            try {
                watershedMap = this.applyWatershed(quantized, markers);
                console.log('Watershed applied');
            } catch (e) {
                console.error('Watershed failed:', e);
                quantized.delete();
                labels.delete();
                markers.delete();
                throw new Error('Watershed algorithm failed: ' + e);
            }

            this.updateProgress(onProgress, 80, 'Extracting regions...');

            // Step 5: Extract and process regions
            let regions;
            try {
                regions = this.extractRegions(watershedMap, quantized, palette, minRegionSize);
                console.log('Regions extracted:', regions.length);
            } catch (e) {
                console.error('Region extraction failed:', e);
                quantized.delete();
                labels.delete();
                watershedMap.delete(); // markers and watershedMap are same reference
                throw new Error('Region extraction failed: ' + e);
            }

            this.updateProgress(onProgress, 100, 'Complete!');

            // Cleanup OpenCV matrices
            quantized.delete();
            labels.delete();
            // Note: markers and watershedMap are the same Mat reference
            // Only delete watershedMap (the modified version)
            watershedMap.delete();

            return {
                regions,
                palette,
                width: preprocessed.width,
                height: preprocessed.height
            };

        } catch (error) {
            console.error('Watershed processing error:', error);
            throw error;
        }
    }

    /**
     * Preprocess image (resize, filter)
     * @param {ImageData} imageData
     * @param {number} maxSize
     * @returns {ImageData}
     */
    async preprocessImage(imageData, maxSize) {
        console.log('Preprocessing image:', imageData.width, 'x', imageData.height);

        const src = cv.matFromImageData(imageData);
        console.log('Source mat:', src.cols, 'x', src.rows, 'channels:', src.channels());

        // Convert RGBA to RGB if needed (bilateralFilter requires 1 or 3 channels)
        let rgb = src;
        if (src.channels() === 4) {
            console.log('Converting RGBA to RGB...');
            rgb = new cv.Mat();
            cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
            src.delete();
        }

        // Resize if needed
        let resized = rgb;
        if (rgb.rows > maxSize || rgb.cols > maxSize) {
            console.log('Resizing image...');
            resized = new cv.Mat();
            const scale = maxSize / Math.max(rgb.rows, rgb.cols);
            const newSize = new cv.Size(
                Math.floor(rgb.cols * scale),
                Math.floor(rgb.rows * scale)
            );
            cv.resize(rgb, resized, newSize, 0, 0, cv.INTER_AREA);
            console.log('Resized to:', newSize.width, 'x', newSize.height);
            rgb.delete();
        }

        // Apply bilateral filter (noise reduction, edge preservation)
        console.log('Applying bilateral filter...');
        const filtered = new cv.Mat();
        cv.bilateralFilter(resized, filtered, 9, 75, 75);
        console.log('Bilateral filter applied');

        // Convert back to RGBA for canvas
        const rgba = new cv.Mat();
        cv.cvtColor(filtered, rgba, cv.COLOR_RGB2RGBA);

        // Convert to ImageData
        const canvas = document.createElement('canvas');
        canvas.width = rgba.cols;
        canvas.height = rgba.rows;
        const ctx = canvas.getContext('2d');
        cv.imshow(canvas, rgba);
        const result = ctx.getImageData(0, 0, canvas.width, canvas.height);

        console.log('Preprocessing complete:', result.width, 'x', result.height);

        // Cleanup
        resized.delete();
        filtered.delete();
        rgba.delete();

        return result;
    }

    /**
     * Create watershed markers from quantized color labels
     * Each connected component of the same color becomes a unique marker
     * @param {cv.Mat} quantized - Quantized color image (RGB)
     * @param {cv.Mat} labels - K-means labels (numPixels x 1)
     * @param {number} numColors - Number of colors
     * @param {string} complexity - 'low' | 'medium' | 'high' | 'extreme'
     * @returns {cv.Mat} Marker image (CV_32S)
     */
    createMarkers(quantized, labels, numColors, complexity) {
        console.log('Creating markers from color labels...');
        const width = quantized.cols;
        const height = quantized.rows;

        // Erode size based on complexity (larger erosion = more boundary area for watershed)
        const erodeSizes = {
            low: 5,
            medium: 3,
            high: 2,
            extreme: 1
        };
        const erodeSize = erodeSizes[complexity] || 3;

        // Create marker image and color mapping
        const markers = new cv.Mat.zeros(height, width, cv.CV_32S);
        const markerToColor = {}; // Maps marker label → palette color index (1-based)
        let nextLabel = 1;

        // For each color, find connected components and assign unique labels
        for (let colorIdx = 0; colorIdx < numColors; colorIdx++) {
            // Create binary mask for this color
            const mask = new cv.Mat.zeros(height, width, cv.CV_8UC1);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelIdx = y * width + x;
                    if (labels.intAt(pixelIdx, 0) === colorIdx) {
                        mask.ucharPtr(y, x)[0] = 255;
                    }
                }
            }

            // Erode to create sure foreground (shrink regions)
            if (erodeSize > 0) {
                const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE,
                    new cv.Size(erodeSize * 2 + 1, erodeSize * 2 + 1));
                cv.erode(mask, mask, kernel);
                kernel.delete();
            }

            // Find connected components in this color mask
            const colorLabels = new cv.Mat();
            const numComponents = cv.connectedComponents(mask, colorLabels, 8, cv.CV_32S);

            // Assign unique marker labels and track color mapping
            for (let comp = 1; comp < numComponents; comp++) {
                const markerLabel = nextLabel + comp - 1;
                markerToColor[markerLabel] = colorIdx + 1; // 1-based palette index
            }

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const component = colorLabels.intAt(y, x);
                    if (component > 0) {
                        markers.intPtr(y, x)[0] = nextLabel + component - 1;
                    }
                }
            }

            nextLabel += numComponents - 1;

            mask.delete();
            colorLabels.delete();
        }

        console.log(`Created ${nextLabel - 1} unique markers from ${numColors} colors`);
        console.log('Complexity:', complexity, '(erode:', erodeSize, 'px)');

        // Store the color map on the instance for use in extractRegions
        this._markerToColor = markerToColor;

        return markers;
    }

    /**
     * Get threshold value based on complexity
     * @param {string} complexity
     * @returns {number}
     */
    getComplexityThreshold(complexity) {
        const thresholds = {
            low: 0.6,      // Fewer markers = larger regions
            medium: 0.4,   // Balanced
            high: 0.2,     // More markers = more detail
            extreme: 0.05  // Maximum detail
        };
        return thresholds[complexity] || 0.4;
    }

    /**
     * Apply watershed algorithm
     * @param {cv.Mat} quantized - Quantized image
     * @param {cv.Mat} markers - Marker labels (must be CV_32S)
     * @returns {cv.Mat} Watershed result
     */
    applyWatershed(quantized, markers) {
        console.log('Applying watershed...');
        console.log('Quantized:', quantized.cols, 'x', quantized.rows, 'channels:', quantized.channels());
        console.log('Markers type:', markers.type(), 'size:', markers.cols, 'x', markers.rows);

        // Ensure quantized is 3-channel RGB
        let rgb;
        try {
            if (quantized.channels() === 4) {
                rgb = new cv.Mat();
                cv.cvtColor(quantized, rgb, cv.COLOR_RGBA2RGB);
                console.log('Converted to RGB (from RGBA)');
            } else if (quantized.channels() === 3) {
                rgb = quantized.clone();
                console.log('Cloned RGB');
            } else {
                throw new Error('Unexpected channel count: ' + quantized.channels());
            }
        } catch (e) {
            throw new Error('RGB preparation failed: ' + e);
        }

        // Markers should already be CV_32S from createMarkers, but verify
        let markers32 = markers;
        if (markers.type() !== cv.CV_32S) {
            console.log('Converting markers to CV_32S...');
            markers32 = new cv.Mat();
            markers.convertTo(markers32, cv.CV_32S);
        } else {
            console.log('Markers already CV_32S');
        }

        // Apply watershed
        try {
            console.log('Calling cv.watershed...');
            cv.watershed(rgb, markers32);
            console.log('Watershed completed');

            // Check result
            let minLabel = Infinity;
            let maxLabel = -Infinity;
            for (let y = 0; y < markers32.rows; y++) {
                for (let x = 0; x < markers32.cols; x++) {
                    const label = markers32.intAt(y, x);
                    if (label < minLabel) minLabel = label;
                    if (label > maxLabel) maxLabel = label;
                }
            }
            console.log(`Watershed labels range: ${minLabel} to ${maxLabel}`);
        } catch (e) {
            rgb.delete();
            if (markers32 !== markers) markers32.delete();
            throw new Error('cv.watershed failed: ' + e);
        }

        // Cleanup
        rgb.delete();

        return markers32;
    }

    /**
     * Extract regions from watershed result
     * @param {cv.Mat} watershedMap - Watershed result
     * @param {cv.Mat} quantized - Quantized image
     * @param {Array} palette - Color palette
     * @param {number} minRegionSize - Minimum region size in pixels
     * @returns {Array} Array of regions
     */
    extractRegions(watershedMap, quantized, palette, minRegionSize) {
        const regions = [];
        const width = watershedMap.cols;
        const height = watershedMap.rows;
        const markerToColor = this._markerToColor || {};

        // Get unique labels (excluding -1 which is boundary)
        const uniqueLabels = new Set();
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const label = watershedMap.intAt(y, x);
                if (label > 0) {
                    uniqueLabels.add(label);
                }
            }
        }

        console.log(`Found ${uniqueLabels.size} regions from watershed`);

        // Extract each region
        uniqueLabels.forEach(label => {
            // Create mask for this region
            const mask = new cv.Mat.zeros(height, width, cv.CV_8UC1);
            let pixelCount = 0;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (watershedMap.intAt(y, x) === label) {
                        mask.ucharPtr(y, x)[0] = 255;
                        pixelCount++;
                    }
                }
            }

            // Skip if region is too small
            if (pixelCount < minRegionSize) {
                mask.delete();
                return;
            }

            // Find contour of this region
            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            if (contours.size() > 0) {
                const contour = contours.get(0);

                // Get color ID from marker-to-color mapping (direct, no guessing)
                let colorId = markerToColor[label] || 1;

                // Clamp to valid palette range
                if (colorId < 1 || colorId > palette.length) colorId = 1;

                // Calculate centroid for number placement
                const moments = cv.moments(contour);
                const centroid = {
                    x: Math.round(moments.m10 / moments.m00),
                    y: Math.round(moments.m01 / moments.m00)
                };

                // Calculate area
                const area = cv.contourArea(contour);

                regions.push({
                    id: label,
                    contour: this.contourToArray(contour),
                    centroid,
                    area,
                    colorId,
                    color: palette[colorId - 1]
                });

                contour.delete();
            }

            mask.delete();
            contours.delete();
            hierarchy.delete();
        });

        console.log(`Extracted ${regions.length} valid regions`);
        return regions;
    }

    /**
     * Convert OpenCV contour to array of points
     * @param {cv.Mat} contour - OpenCV contour
     * @returns {Array} Array of {x, y} points
     */
    contourToArray(contour) {
        const points = [];
        for (let i = 0; i < contour.rows; i++) {
            points.push({
                x: contour.intAt(i, 0),
                y: contour.intAt(i, 1)
            });
        }
        return points;
    }

    /**
     * Find closest palette color
     * @param {{r, g, b}} color - Color to match
     * @param {Array} palette - Palette colors
     * @returns {number} Color ID (1-indexed)
     */
    findClosestColor(color, palette) {
        let minDist = Infinity;
        let closestId = 1;

        palette.forEach((paletteColor, index) => {
            const dist = Math.sqrt(
                Math.pow(color.r - paletteColor.rgb.r, 2) +
                Math.pow(color.g - paletteColor.rgb.g, 2) +
                Math.pow(color.b - paletteColor.rgb.b, 2)
            );

            if (dist < minDist) {
                minDist = dist;
                closestId = index + 1;
            }
        });

        return closestId;
    }

    /**
     * Update progress callback
     * @param {Function} callback
     * @param {number} percent
     * @param {string} message
     */
    updateProgress(callback, percent, message) {
        if (callback) {
            callback({ percent, message });
        }
    }
}
