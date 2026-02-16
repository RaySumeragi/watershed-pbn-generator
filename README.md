# Watershed Paint-by-Numbers Generator

Professional paint-by-numbers generator using the **Watershed algorithm** for guaranteed **no double edges**. Browser-based, offline-capable, and production-ready.

## ✨ Features

- ✅ **No Double Edges** - Watershed algorithm creates regions first, boundaries emerge naturally
- 🎨 **K-Means Color Quantization** in Lab color space for perceptual accuracy
- 📊 **4 Presets**: Kids, Teens, Adults, Expert
- 🎯 **Adjustable Complexity**: Low to Extreme detail levels
- 📦 **Batch Processing** with ZIP export
- 📐 **SVG + PNG Export** - Scalable vector graphics
- 🎨 **Color Legend** generation
- 🌐 **Browser-Based** - No server required, works offline
- 🚀 **OpenCV.js** powered - Industry-standard image processing

## 🚀 Quick Start

### Requirements

- Modern web browser (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- No installation required!

### Usage

1. **Open `index.html`** in your web browser
2. **Upload an image** (drag & drop or browse)
3. **Choose a preset** or adjust settings
4. **Click "Generate PBN"**
5. **Download** SVG, PNG, or Legend

## 📁 Project Structure

```
watershed-pbn-generator/
├── index.html              # Main application
├── css/
│   ├── main.css           # Core styles
│   └── components.css     # Component styles
├── js/
│   ├── app.js             # Main orchestrator
│   ├── watershedProcessor.js  # ⭐ Core watershed algorithm
│   ├── colorQuantizer.js  # K-means in Lab space
│   ├── regionExtractor.js # Region processing
│   ├── svgGenerator.js    # SVG generation
│   ├── batchProcessor.js  # Batch mode
│   └── utils.js           # Helper functions
└── README.md
```

## 🎯 How It Works

### The Watershed Algorithm

```
INPUT IMAGE
    ↓
1. Preprocessing (resize, bilateral filter, RGB → Lab)
    ↓
2. Color Quantization (K-Means clustering, 6-16 colors)
    ↓
3. Watershed Markers (distance transform + local maxima)
    ↓
4. Watershed Segmentation ⭐ NO DOUBLE EDGES!
    ↓
5. Region Extraction (contours, simplification, numbering)
    ↓
OUTPUT: SVG + Legend + PNG
```

### Why Watershed?

Traditional paint-by-numbers generators use **edge detection** (Canny, Sobel) which creates **double edges** when overlaid on color regions.

Watershed works **region-first**: it creates regions through segmentation, and boundaries emerge naturally between regions → **guaranteed single edges**.

## ⚙️ Settings

### Presets

| Preset | Colors | Complexity | Best For |
|--------|--------|------------|----------|
| **Kids** 👶 | 6 | Low | Children, beginners |
| **Teens** 👦 | 10 | Medium | Teenagers, casual |
| **Adults** 👤 | 14 | High | Adults, hobbyists |
| **Expert** 🎯 | 16 | Extreme | Professionals, detailed work |

### Advanced Settings

- **Number of Colors**: 6-16 colors
- **Complexity Level**: Low / Medium / High / Extreme
- **Min Region Size**: 50-500 pixels
- **Line Width**: 1-5 pixels
- **Number Size**: 8-20 points
- **Show Numbers**: Toggle numbers on/off
- **Show Preview Colors**: Toggle color preview
- **Background Color**: Customizable

## 📦 Batch Mode

1. Switch to **Batch Mode**
2. Upload **multiple images**
3. Configure settings (applied to all)
4. Click **Process All Images**
5. Downloads as **ZIP** (SVG + Legend per image)

## 🎨 Output Files

### Single Image

- `image_pbn.svg` - Paint-by-numbers template
- `image_legend.svg` - Color legend with swatches
- `image_pbn.png` - Raster version

### Batch Export

- `pbn-batch-export.zip` containing:
  - `image1_pbn.svg`
  - `image1_legend.svg`
  - `image2_pbn.svg`
  - `image2_legend.svg`
  - ...

## 🔧 Technical Details

### Dependencies

- **OpenCV.js 4.9.0** - Watershed, distance transform, K-Means
- **JSZip 3.10.1** - Batch ZIP export
- **FileSaver 2.0.5** - Download helper

All loaded from CDN - no local installation required.

### Browser Compatibility

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 80+ |
| Firefox | 75+ |
| Safari | 13+ |
| Edge | 80+ |

### Performance

- **Preprocessing**: ~200ms
- **Watershed**: ~500-2000ms (depends on complexity)
- **SVG Generation**: ~100ms
- **Total**: 1-3 seconds per image

Recommended image size: **512x512 to 1024x1024 pixels**

## 📊 Comparison with Existing Tools

| Feature | color-craft-studio | V4 Polygon (Python) | claude-grid-gen | **Watershed PBN** |
|---------|-------------------|---------------------|-----------------|-------------------|
| **Double Edges** | ❌ Has | ❌ Has | ✅ None | ✅ **None (by design)** |
| **SVG Export** | ✅ Yes | ❌ No | ❌ No | ✅ **Yes** |
| **Complexity Control** | ⚠️ Limited | ✅ 5 levels | ✅ Grid control | ✅ **4 presets + sliders** |
| **Batch Mode** | ❌ No | ✅ CLI | ✅ CLI | ✅ **Browser-based** |
| **Offline** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ **Yes** |
| **Algorithm** | Edge detection | Polygon + Edge | Grid + Polygonize | **Watershed (region-first)** |

## 🎯 Use Cases

- **Gumroad Products** - High-quality digital products
- **Etsy Shop** - Printable coloring pages
- **Print-on-Demand** - KDP, Redbubble, Society6
- **Educational Materials** - Children's activity books
- **Art Therapy** - Adult coloring books
- **Custom Gifts** - Personalized paint-by-numbers

## 🐛 Troubleshooting

### OpenCV not loading

- Check internet connection (required for CDN)
- Try refreshing the page
- Check browser console for errors

### Image too large

- Recommended max: 2000x2000 pixels
- Tool auto-resizes to 1024px max dimension

### Too many regions

- Increase **Min Region Size**
- Reduce **Complexity Level**
- Reduce **Number of Colors**

### Numbers overlapping

- Reduce **Number Size**
- Increase **Min Region Size**
- Some overlap is normal for complex images

## 📝 License

MIT License - Free for commercial use.

- ✅ Use for Gumroad/Etsy products
- ✅ Print-on-Demand services
- ✅ Commercial projects
- ✅ No attribution required (appreciated!)

## 🙏 Credits

- **OpenCV.js** - Computer vision library
- **Watershed Algorithm** - L. Vincent & P. Soille (1991)
- **K-Means in Lab Space** - Better perceptual color grouping
- **Douglas-Peucker** - Contour simplification

## 🚀 Future Enhancements

- [ ] Web Workers for background processing
- [ ] Progressive rendering for large images
- [ ] Custom color palette support
- [ ] Region merging tools
- [ ] Number placement optimization
- [ ] PDF export
- [ ] Mobile app version

## 📧 Support

For issues or questions:
- Check browser console for errors
- Ensure OpenCV.js loaded successfully
- Try different preset/settings combinations

---

**Powered by OpenCV.js Watershed Algorithm** | No Double Edges, Guaranteed 🎯
