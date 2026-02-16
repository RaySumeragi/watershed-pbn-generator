/* ============================================
   Region Extractor - Contour Simplification
   ============================================ */

class RegionExtractor {
    /**
     * Simplify contours using Douglas-Peucker algorithm
     * @param {Array} contour - Array of {x, y} points
     * @param {number} epsilon - Approximation accuracy
     * @returns {Array} Simplified contour
     */
    simplifyContour(contour, epsilon = 2.0) {
        if (contour.length < 3) return contour;

        // Check if OpenCV is loaded
        if (typeof cv === 'undefined' || !cv.Mat) {
            console.warn('OpenCV.js not loaded, returning original contour');
            return contour;
        }

        // Convert to OpenCV format
        const points = cv.matFromArray(contour.length, 1, cv.CV_32SC2,
            contour.flatMap(p => [p.x, p.y])
        );

        // Apply Douglas-Peucker
        const approx = new cv.Mat();
        cv.approxPolyDP(points, approx, epsilon, true);

        // Convert back to array
        const simplified = [];
        for (let i = 0; i < approx.rows; i++) {
            simplified.push({
                x: approx.intAt(i, 0),
                y: approx.intAt(i, 1)
            });
        }

        points.delete();
        approx.delete();

        return simplified;
    }

    /**
     * Merge small regions into neighbors
     * @param {Array} regions
     * @param {number} minSize
     * @returns {Array} Filtered regions
     */
    filterSmallRegions(regions, minSize) {
        return regions.filter(r => r.area >= minSize);
    }

    /**
     * Calculate region statistics
     * @param {Object} region
     * @returns {Object} Statistics
     */
    getRegionStats(region) {
        const { contour, area, centroid } = region;

        // Bounding box
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        contour.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        return {
            boundingBox: { minX, minY, maxX, maxY },
            width: maxX - minX,
            height: maxY - minY,
            perimeter: this.calculatePerimeter(contour),
            compactness: (4 * Math.PI * area) / Math.pow(this.calculatePerimeter(contour), 2)
        };
    }

    /**
     * Calculate perimeter of contour
     * @param {Array} contour
     * @returns {number}
     */
    calculatePerimeter(contour) {
        let perimeter = 0;
        for (let i = 0; i < contour.length; i++) {
            const p1 = contour[i];
            const p2 = contour[(i + 1) % contour.length];
            perimeter += Math.sqrt(
                Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
            );
        }
        return perimeter;
    }
}
