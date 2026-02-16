/* ============================================
   Color Quantizer - K-Means in Lab Space
   ============================================ */

class ColorQuantizer {
    /**
     * Quantize colors using K-Means clustering in Lab color space
     * @param {ImageData} imageData - Source image data
     * @param {number} numColors - Number of colors to reduce to (6-16)
     * @returns {{quantized: cv.Mat, palette: Array, labels: cv.Mat}}
     */
    quantize(imageData, numColors) {
        // Check if OpenCV is loaded
        if (typeof cv === 'undefined' || !cv.Mat) {
            throw new Error('OpenCV.js is not loaded');
        }

        console.log('ColorQuantizer: Starting quantization for', numColors, 'colors');
        console.log('Input image:', imageData.width, 'x', imageData.height);

        // Convert ImageData to OpenCV Mat
        const src = cv.matFromImageData(imageData);
        console.log('Mat created:', src.cols, 'x', src.rows, 'channels:', src.channels());

        // Convert to RGB first
        const rgb = new cv.Mat();
        try {
            if (src.channels() === 4) {
                cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
                console.log('Converted RGBA to RGB');
            } else {
                src.copyTo(rgb);
                console.log('Image already RGB');
            }
        } catch (e) {
            src.delete();
            throw new Error('RGB conversion failed: ' + e);
        }

        // Convert RGB to Lab color space (better for perceptual distance)
        const lab = new cv.Mat();
        try {
            cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
            console.log('Converted RGB to Lab');
        } catch (e) {
            src.delete();
            rgb.delete();
            throw new Error('Lab conversion failed: ' + e);
        }

        // Reshape to 2D array for K-Means (each pixel is a row)
        // OpenCV.js reshape: reshape(cn, rows)
        console.log('Reshaping Lab image for K-Means...');
        const numPixels = lab.rows * lab.cols;
        console.log('Total pixels:', numPixels);

        // Use OpenCV's reshape method (if available) or manual method
        let samples;
        try {
            // Try OpenCV's built-in reshape
            samples = lab.reshape(1, numPixels);
            samples.convertTo(samples, cv.CV_32F);
            console.log('✅ Used OpenCV reshape');
        } catch (e) {
            // Fallback: Create Float32Array and use cv.matFromArray (much faster!)
            console.log('Using fast Float32Array method...');
            const data = new Float32Array(numPixels * 3);
            let idx = 0;
            for (let y = 0; y < lab.rows; y++) {
                for (let x = 0; x < lab.cols; x++) {
                    data[idx++] = lab.ucharPtr(y, x)[0]; // L
                    data[idx++] = lab.ucharPtr(y, x)[1]; // a
                    data[idx++] = lab.ucharPtr(y, x)[2]; // b
                }
            }
            samples = cv.matFromArray(numPixels, 3, cv.CV_32F, data);
            console.log('✅ Used Float32Array method');
        }

        console.log('Samples ready:', samples.rows, 'x', samples.cols);

        // K-Means clustering
        console.log('Running K-Means clustering...');
        const labels = new cv.Mat();
        const centers = new cv.Mat();
        const criteria = new cv.TermCriteria(
            cv.TERM_CRITERIA_EPS + cv.TERM_CRITERIA_MAX_ITER,
            100,
            0.2
        );

        try {
            cv.kmeans(
                samples,
                numColors,
                labels,
                criteria,
                3, // Attempts
                cv.KMEANS_PP_CENTERS,
                centers // 7th param: output centers!
            );
            console.log('K-Means complete. Centers:', centers.rows, 'x', centers.cols, 'Labels:', labels.rows);
        } catch (e) {
            src.delete();
            rgb.delete();
            lab.delete();
            samples.delete();
            labels.delete();
            centers.delete();
            throw new Error('K-Means clustering failed: ' + e);
        }

        // Calculate palette colors from actual pixel data per cluster
        // (More reliable than centers which may not populate in OpenCV.js)
        const palette = [];
        const colorSums = new Array(numColors).fill(null).map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

        // Sum RGB values per cluster from original image
        const totalPixels = rgb.rows * rgb.cols;
        for (let i = 0; i < totalPixels; i++) {
            const label = labels.intAt(i, 0);
            if (label >= 0 && label < numColors) {
                const y = Math.floor(i / rgb.cols);
                const x = i % rgb.cols;
                colorSums[label].r += rgb.ucharPtr(y, x)[0];
                colorSums[label].g += rgb.ucharPtr(y, x)[1];
                colorSums[label].b += rgb.ucharPtr(y, x)[2];
                colorSums[label].count++;
            }
        }

        // Build palette from averaged colors
        for (let i = 0; i < numColors; i++) {
            const sum = colorSums[i];
            const avgRgb = sum.count > 0 ? {
                r: Math.round(sum.r / sum.count),
                g: Math.round(sum.g / sum.count),
                b: Math.round(sum.b / sum.count)
            } : { r: 128, g: 128, b: 128 };

            palette.push({
                id: i + 1,
                rgb: avgRgb,
                hex: Utils.rgbToHex(avgRgb.r, avgRgb.g, avgRgb.b),
                name: Utils.getColorName(avgRgb.r, avgRgb.g, avgRgb.b)
            });

            console.log(`  Color ${i + 1}: ${Utils.rgbToHex(avgRgb.r, avgRgb.g, avgRgb.b)} (${sum.count} px)`);
        }

        // Create quantized image
        const quantized = new cv.Mat(rgb.rows, rgb.cols, cv.CV_8UC3);
        for (let i = 0; i < totalPixels; i++) {
            const label = labels.intAt(i, 0);
            const y = Math.floor(i / rgb.cols);
            const x = i % rgb.cols;
            const color = palette[label].rgb;
            quantized.ucharPtr(y, x)[0] = color.r;
            quantized.ucharPtr(y, x)[1] = color.g;
            quantized.ucharPtr(y, x)[2] = color.b;
        }

        // Cleanup
        src.delete();
        rgb.delete();
        lab.delete();
        samples.delete();
        centers.delete();

        console.log('ColorQuantizer: Quantization complete,', palette.length, 'colors');
        return { quantized, palette, labels };
    }

    /**
     * Convert Lab to RGB
     * @param {number} l - Lightness (0-100)
     * @param {number} a - a channel (-128 to 127)
     * @param {number} b - b channel (-128 to 127)
     * @returns {{r: number, g: number, b: number}}
     */
    labToRgb(l, a, b) {
        // Lab to XYZ
        let y = (l + 16) / 116;
        let x = a / 500 + y;
        let z = y - b / 200;

        const xyz_to_rgb = (val) => {
            return val > 0.008856 ? Math.pow(val, 3) : (val - 16/116) / 7.787;
        };

        x = 95.047 * xyz_to_rgb(x);
        y = 100.000 * xyz_to_rgb(y);
        z = 108.883 * xyz_to_rgb(z);

        // XYZ to RGB
        x = x / 100;
        y = y / 100;
        z = z / 100;

        let r = x *  3.2406 + y * -1.5372 + z * -0.4986;
        let g = x * -0.9689 + y *  1.8758 + z *  0.0415;
        let bVal = x *  0.0557 + y * -0.2040 + z *  1.0570;

        const rgb_to_srgb = (val) => {
            return val > 0.0031308 ?
                1.055 * Math.pow(val, 1/2.4) - 0.055 :
                12.92 * val;
        };

        r = Math.max(0, Math.min(1, rgb_to_srgb(r)));
        g = Math.max(0, Math.min(1, rgb_to_srgb(g)));
        bVal = Math.max(0, Math.min(1, rgb_to_srgb(bVal)));

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(bVal * 255)
        };
    }

    /**
     * Apply bilateral filter for noise reduction while preserving edges
     * @param {cv.Mat} src - Source image
     * @returns {cv.Mat} Filtered image
     */
    applyBilateralFilter(src) {
        const dst = new cv.Mat();
        cv.bilateralFilter(src, dst, 9, 75, 75);
        return dst;
    }

    /**
     * Get dominant colors using histogram
     * @param {ImageData} imageData
     * @param {number} numColors
     * @returns {Array} Array of dominant colors
     */
    getDominantColors(imageData, numColors = 8) {
        const src = cv.matFromImageData(imageData);
        const hsv = new cv.Mat();
        cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
        cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

        // Calculate histogram
        const hist = new cv.Mat();
        const channels = [0, 1]; // H and S channels
        const histSize = [180, 256];
        const ranges = [0, 180, 0, 256];
        const mask = new cv.Mat();

        cv.calcHist(new cv.MatVector().push_back(hsv), channels, mask, hist, histSize, ranges, false);

        // Find peaks in histogram
        const peaks = [];
        // ... histogram peak detection logic ...

        src.delete();
        hsv.delete();
        hist.delete();
        mask.delete();

        return peaks;
    }
}
