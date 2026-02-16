/* ============================================
   Utilities - Helper Functions
   ============================================ */

const Utils = {
    /**
     * Load image from file
     * @param {File} file - Image file
     * @returns {Promise<HTMLImageElement>}
     */
    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Load image from URL
     * @param {string} url - Image URL
     * @returns {Promise<HTMLImageElement>}
     */
    loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    },

    /**
     * Resize image to max dimensions while preserving aspect ratio
     * @param {HTMLImageElement} image - Source image
     * @param {number} maxSize - Maximum width or height
     * @returns {{canvas: HTMLCanvasElement, width: number, height: number}}
     */
    resizeImage(image, maxSize = 1024) {
        let width = image.width;
        let height = image.height;

        // Calculate new dimensions
        if (width > height && width > maxSize) {
            height = (height / width) * maxSize;
            width = maxSize;
        } else if (height > maxSize) {
            width = (width / height) * maxSize;
            height = maxSize;
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);

        return { canvas, width, height };
    },

    /**
     * Get ImageData from image element
     * @param {HTMLImageElement} image - Source image
     * @param {number} maxSize - Maximum size
     * @returns {ImageData}
     */
    getImageData(image, maxSize = 1024) {
        const { canvas } = this.resizeImage(image, maxSize);
        const ctx = canvas.getContext('2d');
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    },

    /**
     * Convert ImageData to canvas
     * @param {ImageData} imageData
     * @returns {HTMLCanvasElement}
     */
    imageDataToCanvas(imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    },

    /**
     * Download canvas as PNG
     * @param {HTMLCanvasElement} canvas
     * @param {string} filename
     */
    downloadCanvas(canvas, filename = 'image.png') {
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        });
    },

    /**
     * Download SVG string as file
     * @param {string} svgString - SVG content
     * @param {string} filename
     */
    downloadSvg(svgString, filename = 'image.svg') {
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    /**
     * Format file size
     * @param {number} bytes
     * @returns {string}
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    /**
     * RGB to Hex color
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {string}
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    },

    /**
     * Hex to RGB color
     * @param {string} hex - Hex color (#RRGGBB)
     * @returns {{r: number, g: number, b: number}}
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    /**
     * Get color name from RGB (simplified)
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @returns {string}
     */
    getColorName(r, g, b) {
        // Simple color naming based on dominant channel
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const brightness = (r + g + b) / 3;

        if (max - min < 30) {
            // Grayscale
            if (brightness < 50) return 'Black';
            if (brightness < 100) return 'Dark Gray';
            if (brightness < 180) return 'Gray';
            if (brightness < 230) return 'Light Gray';
            return 'White';
        }

        // Determine dominant color
        if (r > g && r > b) {
            if (g > 100 && b < 100) return 'Yellow';
            if (g < 100 && b > 100) return 'Purple';
            return r > 180 ? 'Red' : 'Dark Red';
        } else if (g > r && g > b) {
            if (b > 100 && r < 100) return 'Cyan';
            if (r > 100 && b < 100) return 'Yellow';
            return g > 180 ? 'Green' : 'Dark Green';
        } else {
            if (r > 100 && g < 100) return 'Purple';
            if (g > 100 && r < 100) return 'Cyan';
            return b > 180 ? 'Blue' : 'Dark Blue';
        }
    },

    /**
     * Show toast notification
     * @param {string} message
     * @param {string} type - success, error, info, warning
     * @param {number} duration - milliseconds
     */
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
            </div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    },

    /**
     * Debounce function
     * @param {Function} func
     * @param {number} wait
     * @returns {Function}
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Clamp value between min and max
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
};

// OpenCV.js ready callback
window.onOpenCvReady = function() {
    console.log('OpenCV.js is ready');
    const badge = document.getElementById('opencvStatus');
    if (badge) {
        badge.textContent = 'OpenCV Ready';
        badge.classList.add('success');
    }

    // Dispatch custom event
    window.dispatchEvent(new Event('opencv-ready'));
};
