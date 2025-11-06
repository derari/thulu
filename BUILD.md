# Building Thulu for Distribution

This guide covers how to build standalone executable packages of Thulu for Windows, macOS, and Linux.

## Prerequisites

1. **Node.js and npm** installed
2. **Dependencies installed**: Run `npm install` in the root directory
3. **Renderer built**: The build process will handle this automatically

## Build Commands

### Build for Your Current Platform

```bash
npm run build
```

This builds the application for your current operating system (Windows, macOS, or Linux).

### Build for Specific Platforms

#### Windows
```bash
npm run build:win
```

Produces:
- `dist-packages/Thulu Setup {version}.exe` - Installer (NSIS)
- `dist-packages/Thulu-{version}-portable.exe` - Portable executable (no installation)
- `dist-packages/Thulu-{version}-win.zip` - Zipped executable

#### macOS
```bash
npm run build:mac
```

Produces:
- `dist-packages/Thulu-{version}.dmg` - macOS disk image installer
- `dist-packages/Thulu-{version}-mac.zip` - Zipped app bundle

Architectures: Universal build (Apple Silicon ARM64 + Intel x64)

#### Linux
```bash
npm run build:linux
```

Produces:
- `dist-packages/Thulu-{version}.AppImage` - AppImage (universal Linux executable)
- `dist-packages/thulu_{version}_amd64.deb` - Debian/Ubuntu package
- `dist-packages/thulu-{version}.x86_64.rpm` - RedHat/Fedora package
- `dist-packages/Thulu-{version}.tar.gz` - Tarball

### Build for All Platforms
```bash
npm run build:all
```

Builds for Windows, macOS, and Linux (requires appropriate build tools on your system).

## Output

All built packages are placed in the `dist-packages/` directory.

## Platform-Specific Notes

### Windows

**Building on Windows:**
- All Windows targets work natively
- Produces both installer and portable versions
- ARM64 and x64 architectures supported

**Building on macOS/Linux:**
- Windows builds work via Wine
- May require Wine installation: `brew install wine` (macOS) or `apt install wine` (Linux)

### macOS

**Building on macOS:**
- Produces Universal builds (ARM64 + x64)
- Can create DMG and ZIP formats
- No code signing configured (apps will show "unidentified developer" warning)

**Building on Windows/Linux:**
- Requires macOS SDK or cannot build DMG
- Consider building on actual macOS for best results

### Linux

**Building on Linux:**
- All Linux targets work natively
- AppImage is most portable (works on any Linux distro)
- DEB for Debian/Ubuntu, RPM for RedHat/Fedora

**Building on Windows/macOS:**
- Most Linux targets work via Docker
- electron-builder may auto-setup Docker if needed

## Distribution

### Windows
- **Installer (NSIS)**: Best for most users, adds to Start Menu
- **Portable**: No installation required, can run from USB drive
- **ZIP**: Extract and run

### macOS
- **DMG**: Standard macOS distribution format
- Drag to Applications folder to install
- First run may require right-click → Open (unsigned app warning)

### Linux
- **AppImage**: Most portable, works on most distros
  - Make executable: `chmod +x Thulu-*.AppImage`
  - Run directly: `./Thulu-*.AppImage`
- **DEB**: For Debian/Ubuntu users
  - Install: `sudo dpkg -i thulu_*.deb`
- **RPM**: For RedHat/Fedora users
  - Install: `sudo rpm -i thulu-*.rpm`

## Configuration

Build configuration is in `electron-builder.config.json`:
- App ID: `org.cthul.thulu`
- Build output: `dist-packages/`
- Icons: `production/icon.*` (icns/ico/png)

## Icons

Place icons in the `production/` directory:
- **macOS**: `icon.icns` (512x512 recommended)
- **Windows**: `icon.ico` (256x256 recommended)
- **Linux**: `icon.png` (512x512 recommended)

If icons don't exist, electron-builder will use default Electron icons.

## Troubleshooting

### Build Fails
1. Ensure all dependencies are installed: `npm install`
2. Build the renderer first: `npm run build:svelte`
3. Compile TypeScript: `tsc`
4. Check for TypeScript errors in `src/` directory

### Large Package Size
The package includes:
- Electron runtime (~150-200 MB)
- Node modules
- Your app code
- Renderer build

This is normal for Electron apps.

### Code Signing (macOS/Windows)
Code signing requires:
- **macOS**: Apple Developer account + certificates
- **Windows**: Code signing certificate

Without signing:
- macOS shows "unidentified developer" warning
- Windows may show SmartScreen warning

Users can still run the app by allowing it in system settings.

## Quick Reference

| Command | Description | Output |
|---------|-------------|--------|
| `npm run build` | Build for current platform | Platform-specific packages |
| `npm run build:win` | Build for Windows | NSIS installer, portable, zip |
| `npm run build:mac` | Build for macOS | DMG, ZIP (universal) |
| `npm run build:linux` | Build for Linux | AppImage, DEB, RPM, tar.gz |
| `npm run build:all` | Build for all platforms | All formats |

## Development vs Production

**Development** (`npm run dev`):
- Hot reload
- DevTools open
- Faster iteration
- No packaging

**Production** (`npm run build`):
- Optimized build
- Smaller package size
- No DevTools (unless opened manually)
- Standalone executable

## Next Steps

1. Build for your platform: `npm run build`
2. Test the package in `dist-packages/`
3. Share the appropriate package with users
4. Consider code signing for production releases

