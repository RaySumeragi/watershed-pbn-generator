/* ============================================
   SVG Generator - Clean Vector Output
   ============================================ */

class SVGGenerator {
    /**
     * Generate SVG from regions
     * @param {Array} regions - Processed regions
     * @param {Array} palette - Color palette
     * @param {Object} options - Generation options
     * @returns {string} SVG string
     */
    generateSVG(regions, palette, options) {
        const {
            width,
            height,
            showNumbers = true,
            numberSize = 12,
            lineWidth = 1.5,
            showColors = false,
            backgroundColor = '#ffffff'
        } = options;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('xmlns', svgNS);
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Background
        const bg = document.createElementNS(svgNS, 'rect');
        bg.setAttribute('width', width);
        bg.setAttribute('height', height);
        bg.setAttribute('fill', backgroundColor);
        svg.appendChild(bg);

        // Group for regions
        const regionsGroup = document.createElementNS(svgNS, 'g');
        regionsGroup.setAttribute('id', 'regions');

        regions.forEach(region => {
            const path = this.createRegionPath(region, {
                fill: showColors ? region.color.hex : 'none',
                stroke: '#000000',
                strokeWidth: lineWidth,
                strokeLinejoin: 'round', // CRITICAL: Prevents double lines at corners
                strokeLinecap: 'round'
            });
            regionsGroup.appendChild(path);
        });

        svg.appendChild(regionsGroup);

        // Numbers layer
        if (showNumbers) {
            const numbersGroup = document.createElementNS(svgNS, 'g');
            numbersGroup.setAttribute('id', 'numbers');

            regions.forEach(region => {
                const text = document.createElementNS(svgNS, 'text');
                text.setAttribute('x', region.centroid.x);
                text.setAttribute('y', region.centroid.y);
                text.setAttribute('font-size', numberSize);
                text.setAttribute('font-weight', 'bold');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'middle');
                text.setAttribute('fill', '#666666');
                text.setAttribute('font-family', 'Arial, sans-serif');
                text.textContent = region.colorId;
                numbersGroup.appendChild(text);
            });

            svg.appendChild(numbersGroup);
        }

        return new XMLSerializer().serializeToString(svg);
    }

    /**
     * Create SVG path from region
     * @param {Object} region
     * @param {Object} style
     * @returns {SVGPathElement}
     */
    createRegionPath(region, style) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        // Convert contour to SVG path string
        const pathData = this.contourToPathData(region.contour);
        path.setAttribute('d', pathData);

        // Apply styles
        Object.entries(style).forEach(([key, value]) => {
            const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            path.setAttribute(attrName, value);
        });

        return path;
    }

    /**
     * Convert contour array to SVG path data using Catmull-Rom → cubic Bezier curves.
     * Produces smooth curves through the control points instead of jagged line segments.
     * @param {Array} contour - Array of {x, y} points
     * @returns {string} SVG path data string
     */
    contourToPathData(contour) {
        if (contour.length === 0) return '';
        if (contour.length < 3) {
            // Fall back to lines for degenerate contours
            let d = `M ${contour[0].x} ${contour[0].y}`;
            for (let i = 1; i < contour.length; i++) {
                d += ` L ${contour[i].x} ${contour[i].y}`;
            }
            return d + ' Z';
        }

        const n = contour.length;
        // Catmull-Rom tension (0 = straight, 0.5 = standard smooth)
        const alpha = 0.5;

        // Helper: get point with wrap-around for closed contour
        const pt = i => contour[(i + n) % n];

        // Convert one Catmull-Rom segment (p0,p1,p2,p3) to cubic Bezier control points
        const catmullToBezier = (p0, p1, p2, p3) => {
            const cp1x = p1.x + (p2.x - p0.x) * alpha / 3;
            const cp1y = p1.y + (p2.y - p0.y) * alpha / 3;
            const cp2x = p2.x - (p3.x - p1.x) * alpha / 3;
            const cp2y = p2.y - (p3.y - p1.y) * alpha / 3;
            return { cp1x, cp1y, cp2x, cp2y };
        };

        let pathData = `M ${pt(0).x} ${pt(0).y}`;

        for (let i = 0; i < n; i++) {
            const { cp1x, cp1y, cp2x, cp2y } = catmullToBezier(
                pt(i - 1), pt(i), pt(i + 1), pt(i + 2)
            );
            const next = pt(i + 1);
            pathData += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x} ${next.y}`;
        }

        pathData += ' Z';
        return pathData;
    }

    /**
     * Generate color legend as SVG
     * @param {Array} palette
     * @returns {string} SVG string
     */
    generateLegend(palette) {
        const itemWidth = 180;
        const itemHeight = 40;
        const columns = Math.min(4, palette.length);
        const rows = Math.ceil(palette.length / columns);
        const padding = 10;

        const width = columns * itemWidth + (columns + 1) * padding;
        const height = rows * itemHeight + (rows + 1) * padding;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('xmlns', svgNS);
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Background
        const bg = document.createElementNS(svgNS, 'rect');
        bg.setAttribute('width', width);
        bg.setAttribute('height', height);
        bg.setAttribute('fill', '#ffffff');
        svg.appendChild(bg);

        // Legend items
        palette.forEach((color, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const x = col * itemWidth + (col + 1) * padding;
            const y = row * itemHeight + (row + 1) * padding;

            // Item group
            const group = document.createElementNS(svgNS, 'g');

            // Background rect
            const rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', itemWidth);
            rect.setAttribute('height', itemHeight);
            rect.setAttribute('fill', '#f9f9f9');
            rect.setAttribute('stroke', '#e0e0e0');
            rect.setAttribute('rx', 4);
            group.appendChild(rect);

            // Number
            const numRect = document.createElementNS(svgNS, 'rect');
            numRect.setAttribute('x', x + 5);
            numRect.setAttribute('y', y + 5);
            numRect.setAttribute('width', 30);
            numRect.setAttribute('height', 30);
            numRect.setAttribute('fill', '#ffffff');
            numRect.setAttribute('stroke', '#cccccc');
            numRect.setAttribute('rx', 4);
            group.appendChild(numRect);

            const numText = document.createElementNS(svgNS, 'text');
            numText.setAttribute('x', x + 20);
            numText.setAttribute('y', y + 22);
            numText.setAttribute('font-size', 14);
            numText.setAttribute('font-weight', 'bold');
            numText.setAttribute('text-anchor', 'middle');
            numText.setAttribute('fill', '#333333');
            numText.textContent = color.id;
            group.appendChild(numText);

            // Color swatch
            const swatch = document.createElementNS(svgNS, 'rect');
            swatch.setAttribute('x', x + 40);
            swatch.setAttribute('y', y + 5);
            swatch.setAttribute('width', 30);
            swatch.setAttribute('height', 30);
            swatch.setAttribute('fill', color.hex);
            swatch.setAttribute('stroke', '#cccccc');
            swatch.setAttribute('rx', 4);
            group.appendChild(swatch);

            // Color name
            const nameText = document.createElementNS(svgNS, 'text');
            nameText.setAttribute('x', x + 75);
            nameText.setAttribute('y', y + 16);
            nameText.setAttribute('font-size', 11);
            nameText.setAttribute('font-weight', '600');
            nameText.setAttribute('fill', '#333333');
            nameText.textContent = color.name;
            group.appendChild(nameText);

            // Hex code
            const hexText = document.createElementNS(svgNS, 'text');
            hexText.setAttribute('x', x + 75);
            hexText.setAttribute('y', y + 30);
            hexText.setAttribute('font-size', 9);
            hexText.setAttribute('font-family', 'monospace');
            hexText.setAttribute('fill', '#999999');
            hexText.textContent = color.hex;
            group.appendChild(hexText);

            svg.appendChild(group);
        });

        return new XMLSerializer().serializeToString(svg);
    }

    /**
     * Convert SVG to PNG using canvas
     * @param {string} svgString
     * @param {number} width
     * @param {number} height
     * @returns {Promise<HTMLCanvasElement>}
     */
    async svgToPng(svgString, width, height) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                resolve(canvas);
            };
            img.onerror = reject;

            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            img.src = URL.createObjectURL(blob);
        });
    }
}
