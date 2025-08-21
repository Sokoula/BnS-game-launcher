![ViewCount](https://hits.sh/github.com/war100ck/BnS-game-launcher.svg?style=flat-square)

# Blade & Soul Launcher

[![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows)](https://www.microsoft.com/windows)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron)](https://www.electronjs.org/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?logo=bootstrap)](https://getbootstrap.com/)

<p align="center">
  <img src="https://raw.githubusercontent.com/war100ck/BnS-game-launcher/main/screen/launcher.png" alt="Launcher" width="800px">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/war100ck/BnS-game-launcher/main/screen/process.gif" alt="Launcher" width="800px">
</p>

Launcher for Blade & Soul, built with Electron and Bootstrap. It manages game updates, verifies file integrity, and launches the game client with a sleek, user-friendly interface.

## ⚠️ Important Note

This launcher requires a patch server at `http://<your-server-ip>/bns-patch`.  
Configure the server using the [bns-client-packer](https://github.com/war100ck/bns-client-packer) repository.  
Ensure the IP address is set correctly for updates and game launch (see [IP Configuration](#ip-configuration)).

---

### 🔄 Alternative Patch Server Backend

*As an alternative backend for serving patch files, you can also use the project  
[Server-Api-BnS-2017](https://github.com/war100ck/Server-Api-BnS-2017), or  [BnS-Api-Server](https://github.com/war100ck/BnS-Api-Server), depending on the version of your game server (2017 or 2020).  
Both projects provide a patch API compatible with this launcher and can be configured to host and deliver patch files to the game client,  
offering a more integrated approach for patch distribution.*

## Key Features

- **Automatic Updates**: Downloads and applies game updates from a remote patch server.
- **File Verification**: Validates game files using server-provided MD5 hashes.
- **Real-Time Progress**: Displays verification, download, and extraction progress with file size and speed metrics.
- **Responsive UI**: Clean, modern interface with Bootstrap-based notifications and settings modal.
- **Robust Error Handling**: User-friendly messages for network issues, missing files, or version mismatches.
- **Game Launch**: Starts `Client.exe` with predefined parameters post-update.
- **Cache Management**: Auto-creates and clears `data` and `temp` directories.
- **CAB File Support**: Handles compressed game files via `elzma.exe`.

## Requirements

- **Node.js** (v16+)
- **npm**
- **Windows** (for NSIS and game compatibility)
- **Blade & Soul Client** (with `Client.exe` and `Version.ini` in `BIN`)

## Installation

### For Developers

1. **Clone Repository**:
   ```bash
   git clone https://github.com/war100ck/BnS-game-launcher.git
   cd BnS-game-launcher
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```
   This installs all dependencies listed in `package.json`, including `electron`, `electron-builder`, and others required for development and building.
   
## Configuration

- **Patch Server**: Set in `updater-enhanced.js`.
- **Directories**: `data/` and `temp/` are created at runtime for cache and temporary files.
- **Manual Verification**: Use the "Check Files Integrity" button in settings.  
   
## IP Configuration

To connect to the correct patch server and launch the game, configure the IP address as follows:

- **Patch Server URL**:
  - In `updater-enhanced.js`, update `patchServerUrl` (default: `http://<your-server-ip>/bns-patch`) to your server's IP and port.
- **Game Launch IP**:
  - In `main.js`, update the `/ProxyIP:<your-server-ip>` parameter in the `play-game` IPC handler to your server's IP.
- **Verification**: Ensure the IP matches the server configured in [bns-client-packer](https://github.com/war100ck/bns-client-packer).   

## Building the Executable

1. **Ensure Dependencies**:
   - Verify that Node.js (v16 or higher) and npm are installed.
   - Ensure all dependencies are installed by running `npm install` in the project root. This includes `electron` (^28.0.0) and `electron-builder` (^24.13.3) as specified in `package.json`.

2. **Build the Executable**:
   - Run the following command to build the executable:
     ```bash
     npm run dist
     ```
   - This executes `electron-builder -w`, creating a Windows NSIS installer and an unpacked version.
   - Output files are generated in the `dist/` directory:
     - `Blade & Soul Launcher.exe`: The installer for end users.
     - `win-unpacked/`: The unpacked application for direct use or testing.

3. **Verify the Build**:
   - Test the installer by running `dist/Blade & Soul Launcher.exe` to ensure it installs correctly.
   - Alternatively, run the unpacked app from `dist/win-unpacked/` to verify functionality.
   - Ensure the game folder contains `BIN/Client.exe` and `BIN/Version.ini` for the launcher to work.

4. **Distribute**:
   - Share `dist/Blade & Soul Launcher.exe` for users who want an installer.
   - Alternatively, distribute the contents of `dist/win-unpacked/` for users preferring a portable version.
   - Instruct users to place the launcher files in the root of the Blade & Soul game folder (see [Game Folder Structure](#game-folder-structure)).

## Game Folder Structure

The launcher must be placed in the root of the Blade & Soul game folder, alongside the `BIN` directory. Example structure:

```
Blade & Soul game folder         # Root folder for the Blade & Soul game
│
├── BIN/                         # Folder with 32-64-bit game files
│   ├── Client.exe               # Main executable for the 32-bit game client
│   └── Version.ini              # Configuration file with version information
│
├── contents/                    # Folder containing game content and data
│   ├── Local/                   # Local game data
│   │   ├── GARENA/              # GARENA-specific data
│   │   │   ├── THAI/            # Thai-specific game data
│   │   │   │   ├── CookedPC/    # Compiled game assets for Thai version
│   │   │   │   ├── Splash/      # Splash screen assets
│   │   │   │   └── data/        # Additional data files for Thai version
│   │   └── data/                # General local data files
│   └── bns/                     # Blade & Soul-specific content
│       ├── Config/              # Configuration files for the game
│       ├── CookedPC/            # Compiled game assets
│       └── Logs/                # Log files for game activity
│
├────────────────────────────────────────────────────────────────────
│
│   # Game Launcher Files
│
├── locales/                     # Folder with localization files
│   ├── af.pak                   # Localization for Afrikaans
│   ├── am.pak                   # Localization for Amharic
│   ├── ar.pak                   # Localization for Arabic
│   ├── bg.pak                   # Localization for Bulgarian
│   └── zh-TW.pak                # (other localization files)
│
├── resources/                   # Folder with game resources
│   ├── app.asar                 # Archive containing application code and game resources
│   ├── bin/                     # Binary utilities
│   │   └── elzma.exe            # Compression utility
│   ├── elevate.exe              # Utility for running processes with elevated privileges
│   └──  lib/                     # Library files
│      └── cab.js               # JavaScript library for cabinet file handling
│
├── Blade & Soul Launcher.exe    # Executable file for the game launcher
├── LICENSE.electron.txt         # License for Electron framework
├── LICENSES.chromium.html       # Licenses for Chromium components
├── chrome_100_percent.pak       # Resource package for user interface
├── chrome_200_percent.pak       # Resource package for user interface (high resolution)
├── d3dcompiler_47.dll           # Direct3D library for shader compilation
├── data/                        # Additional game data files
├── ffmpeg.dll                   # Library for audio and video processing
├── icudtl.dat                   # ICU (International Components for Unicode) data
├── libEGL.dll                   # OpenGL ES library for graphics management
├── libGLESv2.dll                # OpenGL ES 2.0 library
├── resources.pak                # Resource package for the game
├── snapshot_blob.bin            # Binary file with snapshots of the state
├── v8_context_snapshot.bin      # Snapshot of the V8 context state
├── vk_swiftshader.dll           # Library for software implementation of Vulkan
├── vk_swiftshader_icd.json      # Configuration file for SwiftShader
└── vulkan-1.dll                 # Library for Vulkan API
```

## Usage

1. **Launch**: Run `Blade & Soul Launcher.exe`.
2. **Update**: Launcher checks `Version.ini` against the server and downloads CAB files if needed.
3. **Play**: Click "Play" to start `Client.exe`.
4. **Monitor**: View real-time progress for verification, downloads, and extraction.

### Notifications

Bootstrap Toast displays:
- Success: e.g., "Update completed!"
- Errors: e.g., "No server connection."
- Warnings: e.g., "X missing, Y modified files."
- Progress: Updates for verification, downloads, and extraction.

## File Structure

```
BnS-game-launcher/
├── BIN/                    # Game client files
│   ├── Client.exe
│   └── Version.ini
├── data/                   # Runtime cache
├── temp/                   # Temporary files
├── lib/
│   ├── bin/
│   │   └── elzma.exe     # Compression utility
│   └── cab.js            # CAB file handling
├── src/
│   ├── assets/
│   │   ├── images/
│   │   │   ├── icon.ico
│   │   │   └── slide/
│   │   │       └── index.jpg
│   └── views/
│       ├── css/
│       │   └── styles.css
│       ├── js/
│       │   └── script.js
│       └── index.html    # Main UI
├── main.js                # Electron main process
├── package.json           # Project config
├── progress-events.js     # Progress event handling
└── updater-enhanced.js    # Update logic
```

## Dependencies

- **electron** (`^28.0.0`)
- **electron-builder** (`^24.13.3`)
- **sqlite3** (`^5.1.6`)
- **md5-file** (`^5.0.0`)
- **ini** (`^5.0.0`)
- **bootstrap** (`^5.3.0`)
- **@popperjs/core** (`^2.11.8`)
- **cross-env** (`^7.0.3`)

## Development

Run in dev mode:
```bash
npm start
```

Enable DevTools in `main.js` for debugging. Use environment variables:
- `NODE_ENV=development`: Development paths.
- `FULL_CHECK=true`: Full file verification.

## License

MIT License - see [LICENSE](LICENSE) for details.

## About

A modern launcher for Blade & Soul, integrating with a private patch server for seamless updates and a polished user experience.

## Additions / Fixes
<details>
  <summary><b>Change Log: 21/08/2025</b></summary>

 **Problem:**  
The launcher was freezing during file extraction in the release version, while in dev mode it worked normally.

## 🔎 Main Causes
- Incorrect paths to `elzma.exe` in release mode  
- Blocking calls with `spawnSync()` for extraction  
- Incorrect update of `Version.ini` with duplicated `v v`  
- Missing `bin` folder with files in the previous release  

## 🔨 Fixes
- **elzma.exe paths** – fixed path resolution for dev and release mode  
- **Asynchronous extraction** – replaced `spawnSync` with `spawn` using `async/await`  
- **Version.ini parsing** – fixed version extraction and updating  
- **Error handling** – added logging and exception handling  
- **bin folder** – added missing folder with files  

## ✅ Result
The launcher now works stably in both modes,  
does not freeze during updates,  
and correctly displays versions.

</details>