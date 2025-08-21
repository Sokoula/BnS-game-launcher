const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const ini = require("ini");
const BnSEnhancedUpdater = require("./updater-enhanced");

// Глобальные переменные
let mainWindow;
let isWindowDestroyed = false;

// Пути к данным
const appDataPath = path.join(process.cwd(), "data");
const cachePath = path.join(appDataPath, "Cache");

// Создание необходимых директорий
function createAppDirectories() {
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }
}

// Установка путей кеша
function setupCachePaths() {
  app.setPath("userData", appDataPath);
  app.setPath("cache", cachePath);
  app.setPath("sessionData", path.join(appDataPath, "Session Data"));
  app.setPath("crashDumps", path.join(appDataPath, "Crash Dumps"));
}

// Очистка старого кеша
function clearCache() {
  const pathsToClear = [
    app.getPath("cache"),
    app.getPath("sessionData"),
    path.join(app.getPath("appData"), app.getName(), "Cache"),
    path.join(app.getPath("appData"), app.getName(), "Session Data"),
    path.join(app.getPath("appData"), app.getName(), "GPUCache"),
  ];

  pathsToClear.forEach((path) => {
    if (fs.existsSync(path)) {
      try {
        fs.rmSync(path, { recursive: true, force: true });
      } catch (err) {
        console.error(`Error clearing cache ${path}:`, err);
      }
    }
  });
}

// Создание главного окна
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    frame: false,
    resizable: false, // Запрет изменения размера окна
    maximizable: false, // Запрет разворачивания окна
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  mainWindow.loadFile("src/views/index.html");

  // Открытие DevTools
  //mainWindow.webContents.openDevTools();

  // Ожидаем полной загрузки окна перед отправкой событий
  mainWindow.webContents.on('did-finish-load', () => {
    startUpdater(false);
  });

  // Обработчики IPC
  ipcMain.on("minimize-window", () => mainWindow.minimize());
  ipcMain.on("close-window", () => {
    mainWindow.destroy();
  });

  ipcMain.on("start-window-drag", () => {
    if (mainWindow && !isWindowDestroyed) {
      mainWindow.startDrag();
    }
  });

  ipcMain.on("get-initial-version", () => {
    try {
      const updater = new BnSEnhancedUpdater({
        clientDirectory: app.isPackaged ? process.cwd() : __dirname,
        versionFile: path.join(
          app.isPackaged ? process.cwd() : __dirname,
          app.isPackaged ? "bin/Version.ini" : "bin/Version.ini"
        ),
      });
      const versionIni = ini.parse(fs.readFileSync(updater.config.versionFile, "utf-8"));
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("initial-version", {
          productVersion: versionIni.Version?.ProductVersion || "Unknown",
          downloadVersion: versionIni.Download?.Version || "Unknown"
        });
      }
    } catch (err) {
      console.error("Error getting initial version:", err);
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-error", "Failed to load initial version.");
      }
    }
  });

  mainWindow.on("closed", () => {
    isWindowDestroyed = true;
    mainWindow = null;
  });
}

// Запуск процесса обновления
async function startUpdater(fullCheck) {
  try {
    const versionFilePath = path.join(
    app.isPackaged ? path.dirname(process.execPath) : __dirname,
    "bin", "Version.ini"
);

const updater = new BnSEnhancedUpdater({
    clientDirectory: app.isPackaged ? path.dirname(process.execPath) : __dirname,
    versionFile: versionFilePath,
    tempDirectory: path.join(
        app.isPackaged ? path.dirname(process.execPath) : __dirname,
        "temp"
    ),
});

    // Читаем ProductVersion и Download.Version из Version.ini
    const versionIni = ini.parse(fs.readFileSync(versionFilePath, "utf-8"));
    const productVersion = versionIni.Version?.ProductVersion || "Unknown";
    const downloadVersion = versionIni.Download?.Version || "Unknown";

    // Перехватываем события от progressEvents
    const progressEvents = require("./progress-events");
    progressEvents.on("verification-start", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-message", {
          type: "verification-start",
          data,
        });
      }
    });
    progressEvents.on("verification-progress", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-message", {
          type: "verification-progress",
          data,
        });
      }
    });
    progressEvents.on("verification-complete", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-message", {
          type: "verification-complete",
          data,
        });
      }
    });
    progressEvents.on("download-start", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-message", {
          type: "download-start",
          data,
        });
      }
    });
    progressEvents.on("download-progress", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-message", {
          type: "download-progress",
          data,
        });
      }
    });
    progressEvents.on("download-complete", () => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-message", {
          type: "download-complete",
        });
      }
    });
    progressEvents.on("extract-start", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-message", {
          type: "extract-start",
          data,
        });
      }
    });
    progressEvents.on("extract-progress", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-message", {
          type: "extract-progress",
          data,
        });
      }
    });
    progressEvents.on("extract-complete", () => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-message", {
          type: "extract-complete",
        });
      }
    });
    progressEvents.on("version-check", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        const correctedData = {
          ...data,
          localVersion: data.localVersion === '0' ? downloadVersion : data.localVersion,
          productVersion,
          newProductVersion: data.newProductVersion || `1.0.72.180 v ${data.remoteVersion}`
        };
        mainWindow.webContents.send("updater-message", {
          type: "version-check",
          data: correctedData,
        });
      }
    });
    progressEvents.on("version-update", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        const updatedData = {
          ...data,
          newProductVersion: data.newProductVersion || `1.0.72.180 v ${data.newVersion}`
        };
        mainWindow.webContents.send("updater-message", {
          type: "version-update",
          data: updatedData,
        });
      }
    });
    progressEvents.on("update-summary", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-message", {
          type: "update-summary",
          data,
        });
      }
    });
    progressEvents.on("error", (data) => {
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater-error", data.error);
      }
    });

    const updateInfo = await updater.checkForUpdates(fullCheck);
    if (updateInfo.updateAvailable) {
      await updater.applyUpdates(updateInfo);
    }
  } catch (err) {
    console.error("Updater error:", err);
    if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater-error", err.message);
    }
  }
}

// IPC обработчики
ipcMain.on("manual-check", () => startUpdater(true));

// Замени текущий обработчик "play-game" на этот код:
ipcMain.on("play-game", () => {
  const gamePath = path.join(
    app.isPackaged ? path.dirname(process.execPath) : __dirname,
    "bin", "Client.exe"
  );

  if (!fs.existsSync(gamePath)) {
    console.error("Game executable not found:", gamePath);
    if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater-error", "Client.exe not found.");
    }
    return;
  }

  const command = `"${gamePath}" /SessKey /LaunchByLauncher /LoginMode 2 /ProxyIP:192.168.0.114 -UnAttended`;
  
  console.log("Launching game and preparing to exit...");
  
  const childProcess = exec(command, { windowsHide: true }, (error, stdout, stderr) => {
    if (error) {
      console.error("Failed to launch Client.exe:", error);
      console.error("STDERR:", stderr);
      if (!isWindowDestroyed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          "updater-error",
          `Failed to launch: ${error.message}`
        );
      }
      // Не закрываем лаунчер при ошибке запуска игры
      return;
    }
    
    // Если игра запустилась успешно (нет ошибки), закрываем лаунчер
    console.log("Client.exe launched successfully. Exiting launcher...");
    app.quit();
  });

  // Дополнительная проверка: если процесс игры завершится с ошибкой быстро,
  // мы также сможем это отследить
  childProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Game process exited with error code: ${code}`);
      // Не закрываем лаунчер при ошибке
    } else {
      console.log("Game process exited normally. Closing launcher...");
      app.quit();
    }
  });

  // Таймаут: если игра запустилась и работает нормально, закрываем лаунчер через 3 секунды
  setTimeout(() => {
    if (!childProcess.killed) {
      console.log("Game launched successfully (timeout check). Closing launcher...");
      app.quit();
    }
  }, 3000);
});

// Инициализация приложения
app.whenReady().then(() => {
  setupCachePaths();
  createAppDirectories();
  clearCache();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});