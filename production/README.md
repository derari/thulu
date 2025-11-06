# Application Icons

Place your application icons in this directory with the following names:

## Required Icons

### macOS
- **icon.icns** - macOS icon file
  - Recommended size: 512x512 or 1024x1024
  - Can be created from PNG using tools like `iconutil` or online converters

### Windows  
- **icon.ico** - Windows icon file
  - Recommended size: 256x256
  - Should include multiple sizes: 16x16, 32x32, 48x48, 256x256
  - Can be created from PNG using tools like ImageMagick or online converters

### Linux
- **icon.png** - Linux icon file
  - Recommended size: 512x512 or 1024x1024
  - PNG format with transparency

## Creating Icons

### From PNG to ICNS (macOS)
Using `iconutil` (macOS):
```bash
# Create iconset folder structure
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

# Convert to icns
iconutil -c icns icon.iconset
```

### From PNG to ICO (Windows)
Using ImageMagick:
```bash
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
```

Or use online converters:
- https://convertio.co/png-ico/
- https://www.icoconverter.com/

## Fallback

If no icons are provided, electron-builder will use the default Electron icon.

## Current Status

⚠️ **Action Required**: Please add your application icons to this directory.

1. Create or obtain a high-resolution PNG (512x512 or larger)
2. Convert to the required formats
3. Place them in this `production/` directory
4. Rebuild the application

## Design Tips

- Use a simple, recognizable design
- Ensure it's visible at small sizes (16x16)
- Use transparency where appropriate
- Test on light and dark backgrounds
- Keep it consistent with your brand

