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

            // Step 3: Create watershed markers
            let markers;
            try {
                markers = this.createMarkers(quantized, complexity);
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
                markers.delete();
                watershedMap.delete();
                throw new Error('Region extraction failed: ' + e);
            }

            this.updateProgress(onProgress, 100, 'Complete!');

            // Cleanup OpenCV matrices
            quantized.delete();
            labels.delete();
            markers.delete();
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
     * Create watershed markers based on complexity
     * @param {cv.Mat} quantized - Quantized color image
     * @param {string} complexity - 'low' | 'medium' | 'high' | 'extreme'
     * @returns {cv.Mat} Marker image
     */
    createMarkers(quantized, complexity) {
        console.log('Creating markers, complexity:', complexity);
        console.log('Quantized image:', quantized.cols, 'x', quantized.rows, 'channels:', quantized.channels());

        // Convert to grayscale
        const gray = new cv.Mat();
        try {
            cv.cvtColor(quantized, gray, cv.COLOR_RGB2GRAY);
            console.log('Converted to grayscale');
        } catch (e) {
            throw new Error('Grayscale conversion failed: ' + e);
        }

        // Apply morphological opening to remove noise
        const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
        const opening = new cv.Mat();
        cv.morphologyEx(gray, opening, cv.MORPH_OPEN, kernel);

        // Sure background area (dilate)
        const sureBg = new cv.Mat();
        cv.dilate(opening, sureBg, kernel, new cv.Point(-1, -1), 3);

        // Distance transform to find sure foreground
        const dist = new cv.Mat();
        cv.distanceTransform(opening, dist, cv.DIST_L2, 5);

        // Threshold to get sure foreground
        const thresholdValue = this.getComplexityThreshold(complexity);
        const sureFg = new cv.Mat();

        // Normalize and threshold
        let maxVal = 0;
        for (let y = 0; y < dist.rows; y++) {
            for (let x = 0; x < dist.cols; x++) {
                const val = dist.floatAt(y, x);
                if (val > maxVal) maxVal = val;
            }
        }
        console.log('Distance transform max:', maxVal);

        const threshold = maxVal * thresholdValue;
        console.log('Threshold value:', threshold);
        cv.threshold(dist, sureFg, threshold, 255, cv.THRESH_BINARY);
        sureFg.convertTo(sureFg, cv.CV_8U);

        // Unknown region (background - foreground)
        const unknown = new cv.Mat();
        cv.subtract(sureBg, sureFg, unknown);

        // Label markers (connected components)
        const markersTemp = new cv.Mat();
        const numMarkers = cv.connectedComponents(sureFg, markersTemp);
        console.log(`Created ${numMarkers} markers for complexity: ${complexity}`);

        // If too few markers, lower threshold and try again
        if (numMarkers < 10) {
            console.warn('Too few markers, retrying with lower threshold...');
            markersTemp.delete();
            const lowerThreshold = threshold * 0.5;
            cv.threshold(dist, sureFg, lowerThreshold, 255, cv.THRESH_BINARY);
            sureFg.convertTo(sureFg, cv.CV_8U);
            const retriedMarkers = cv.connectedComponents(sureFg, markersTemp);
            console.log(`Retried: ${retriedMarkers} markers`);
        }

        // Create final markers with proper type
        const markers = new cv.Mat(markersTemp.rows, markersTemp.cols, cv.CV_32S);

        // Add 1 to all labels and mark unknown regions
        for (let y = 0; y < markers.rows; y++) {
            for (let x = 0; x < markers.cols; x++) {
                const label = markersTemp.intAt(y, x);
                const isUnknown = unknown.ucharAt(y, x) > 0;

                if (isUnknown) {
                    markers.intPtr(y, x)[0] = 0; // Unknown region
                } else {
                    markers.intPtr(y, x)[0] = label + 1; // Shift labels by 1
                }
            }
        }

        console.log('Markers prepared for watershed (CV_32S)');

        // Cleanup
        gray.delete();
        kernel.delete();
        opening.delete();
        sureBg.delete();
        dist.delete();
        sureFg.delete();
        unknown.delete();
        markersTemp.delete();

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
        const visited = new Set();

        // Get unique labels (excluding -1 which is boundary)
        const labels = new Set();
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const label = watershedMap.intAt(y, x);
                if (label > 0) {
                    labels.add(label);
                }
            }
        }

        console.log(`Found ${labels.size} regions from watershed`);

        // Extract each region
        labels.forEach(label => {
            // Create mask for this region
            const mask = new cv.Mat.zeros(height, width, cv.CV_8UC1);
            let pixelCount = 0;
            let colorSum = { r: 0, g: 0, b: 0 };

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (watershedMap.intAt(y, x) === label) {
                        mask.ucharPtr(y, x)[0] = 255;
                        pixelCount++;

                        // Sum colors for average
                        const r = quantized.ucharPtr(y, x)[0];
                        const g = quantized.ucharPtr(y, x)[1];
                        const b = quantized.ucharPtr(y, x)[2];
                        colorSum.r += r;
                        colorSum.g += g;
                        colorSum.b += b;
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

                // Calculate average color
                const avgColor = {
                    r: Math.round(colorSum.r / pixelCount),
                    g: Math.round(colorSum.g / pixelCount),
                    b: Math.round(colorSum.b / pixelCount)
                };

                // Find closest palette color
                const colorId = this.findClosestColor(avgColor, palette);

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
