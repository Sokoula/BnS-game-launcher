"use strict";

const { ipcRenderer } = require('electron');

// Глобальная переменная для хранения productVersion
let productVersion = 'Unknown';

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Обработка перетаскивания окна
document.addEventListener('dragstart', (e) => {
  e.preventDefault(); // Отключаем стандартное перетаскивание
});
document.querySelector('.custom-titlebar')?.addEventListener('mousedown', (e) => {
  if (e.button === 0 && e.target.classList.contains('titlebar-title')) {
    ipcRenderer.send('start-window-drag');
  }
});

// Константы сообщений
const MESSAGES = {
  ERRORS: {
    VERSION_NOT_FOUND: 'Client version not found. Please reinstall the client.',
    NO_CONNECTION: 'No connection to update server. Check your internet connection.',
    FILE_MISSING: 'Required file not found. Please verify client files.',
    UPDATE_FAILED: 'Update failed. Some files may be corrupted.',
    VERIFICATION_FAILED: 'File verification failed. Some files are missing or modified.',
    UNKNOWN_ERROR: 'An unknown error occurred. Check logs for details.'
  },
  SUCCESS: {
    UPDATE_SUCCESS: 'Update completed successfully!',
    VERIFICATION_SUCCESS: 'All files verified successfully!',
    REPAIR_SUCCESS: 'Client repair completed!',
    NO_UPDATES: 'Client is up to date. No updates needed.'
  }
};

// Основные элементы
const elements = {
  versionInfo: document.getElementById('version-info'),
  newVersionInfo: document.getElementById('new-version-info'),
  stageTitle: document.getElementById('stage-title'),
  progressBar: document.getElementById('progress-bar'),
  playBtn: document.getElementById('play-btn'),
  downloadInfo: document.getElementById('download-info'),
  downloaded: document.getElementById('downloaded'),
  speed: document.getElementById('speed'),
  currentFile: document.getElementById('current-file'),
  toast: document.getElementById('error-toast'),
  toastIcon: document.getElementById('toast-icon'),
  toastTitle: document.getElementById('toast-title'),
  toastBody: document.getElementById('error-message'),
  versionNumber: document.getElementById('version-number'),
  newVersionNumber: document.getElementById('new-version-number')
};

// Инициализация Toast
const toast = new bootstrap.Toast(elements.toast, {
  animation: true,
  autohide: true,
  delay: 5000
});

// Форматирование размера файлов
function formatBytes(bytes) {
  if (isNaN(bytes)) return '0 Bytes';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Показать уведомление
function showNotification(type, message) {
  const config = {
    error: { icon: 'bi-exclamation-triangle-fill', title: 'Error', bg: ['bg-danger'] },
    success: { icon: 'bi-check-circle-fill', title: 'Success', bg: ['bg-success'] },
    warning: { icon: 'bi-exclamation-triangle-fill', title: 'Warning', bg: ['bg-warning', 'text-dark'] },
    info: { icon: 'bi-info-circle-fill', title: 'Info', bg: ['bg-info', 'text-dark'] }
  }[type];

  elements.toast.className = 'toast position-fixed top-0 end-0 m-3';
  elements.toast.classList.add(...config.bg);
  elements.toastIcon.className = `bi ${config.icon} me-2`;
  elements.toastTitle.textContent = config.title;
  elements.toastBody.textContent = message;
  toast.show();
}

// Обновление прогресса загрузки
function updateProgress(stage, data) {
  console.log('[Renderer] Updating progress:', { stage, data });
  const stageTitles = {
    'verification': 'Verifying files',
    'download': 'Downloading updates',
    'extract': 'Extracting files'
  };

  elements.stageTitle.textContent = `${stageTitles[stage]} (${data.percent || 0}%)`;
  elements.progressBar.style.width = `${data.percent || 0}%`;

  if (stage === 'download') {
    elements.downloadInfo.style.display = 'flex';
    elements.downloaded.textContent = `${formatBytes(data.downloadedBytes || 0)} / ${formatBytes(data.totalBytes || 0)}`;
    elements.speed.textContent = `${data.speed || 0} MB/s`;
  } else {
    elements.downloadInfo.style.display = 'none';
  }

  if (data.filePath) {
    elements.currentFile.textContent = `Processing: ${data.filePath}`;
  } else {
    elements.currentFile.textContent = '';
  }
}

// Получение начальной версии клиента
function fetchInitialVersion() {
  ipcRenderer.send('get-initial-version');
}

// Обработчики событий
function setupEventListeners() {
  // Кнопка проверки файлов
  document.getElementById('check-files-btn').addEventListener('click', () => {
    elements.playBtn.disabled = true;
    elements.stageTitle.textContent = 'Checking files...';
    ipcRenderer.send('manual-check');
    bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
  });

  // Кнопка Play
  elements.playBtn.addEventListener('click', () => {
    ipcRenderer.send('play-game');
  });

  // IPC обработчики
  ipcRenderer.on('updater-message', (event, message) => {
    console.log('[Renderer] Received updater-message:', JSON.stringify(message, null, 2));
    switch(message.type) {
      case 'verification-start':
      case 'download-start':
      case 'extract-start':
        elements.playBtn.disabled = true;
        updateProgress(
          message.type.replace('-start', ''),
          { percent: 0, totalFiles: message.data.totalFiles }
        );
        break;

      case 'download-progress':
        updateProgress('download', {
          percent: message.data.percent,
          downloadedBytes: message.data.downloadedBytes,
          totalBytes: message.data.totalBytes,
          speed: message.data.speed,
          filePath: message.data.filePath
        });
        break;

      case 'verification-progress':
      case 'extract-progress':
        updateProgress(
          message.type.replace('-progress', ''),
          {
            percent: message.data.percent,
            current: message.data.current,
            total: message.data.total,
            filePath: message.data.filePath
          }
        );
        break;

      case 'version-check':
        handleVersionCheck(message.data);
        break;

      case 'version-update':
        handleVersionUpdate(message.data);
        break;

      case 'verification-complete':
        handleVerificationComplete(message.data);
        break;

      case 'update-summary':
        handleUpdateSummary(message.data);
        break;

      case 'error':
        handleError(message.data);
        break;

      default:
        console.log('[Renderer] Unknown updater-message type:', message.type);
    }
  });

  ipcRenderer.on('initial-version', (event, versionData) => {
    console.log('[Renderer] Received initial-version:', JSON.stringify(versionData, null, 2));
    productVersion = versionData.productVersion || versionData.downloadVersion || 'Unknown';
    elements.versionNumber.textContent = productVersion;
  });

  ipcRenderer.on('updater-error', (event, error) => {
    console.log('[Renderer] Received updater-error:', error);
    showErrorNotification(error);
  });
}

// Обработчики конкретных сообщений
function handleVersionCheck(data) {
  console.log('[Renderer] handleVersionCheck data:', JSON.stringify(data, null, 2));
  // Устанавливаем текущую версию из сохранённого productVersion
  elements.versionNumber.textContent = productVersion;
  
  // Явно обновляем статус
  elements.stageTitle.textContent = 'Checking versions...';
  
  // Проверяем, есть ли обновление
  const localVersionNum = parseInt(data.localVersion, 10) || 0;
  const remoteVersionNum = parseInt(data.remoteVersion, 10) || 0;
  console.log('[Renderer] Comparing versions:', { localVersionNum, remoteVersionNum });
  if (remoteVersionNum > localVersionNum) {
    console.log('[Renderer] Update available:', data.remoteVersion);
    // Используем newProductVersion, если доступно, иначе формируем на основе productVersion
    const newVersionDisplay = data.newProductVersion || `1.0.72.180 v ${data.remoteVersion}`;
    elements.newVersionNumber.textContent = newVersionDisplay;
    elements.newVersionInfo.style.display = 'block';
    elements.stageTitle.textContent = 'Update available';
    elements.playBtn.disabled = true;
  } else if (remoteVersionNum === localVersionNum && localVersionNum !== 0) {
    console.log('[Renderer] Client is up to date:', data.localVersion);
    // Не показываем уведомление здесь, ждём update-summary
    elements.stageTitle.textContent = 'Client is up to date';
    elements.progressBar.style.width = '100%';
    elements.playBtn.disabled = true; // Оставляем кнопку отключённой до verification-complete
    elements.newVersionInfo.style.display = 'none';
  } else {
    console.log('[Renderer] Invalid version data:', data);
    elements.stageTitle.textContent = 'Error checking versions';
    elements.playBtn.disabled = false;
    showNotification('error', MESSAGES.ERRORS.UNKNOWN_ERROR);
  }
}

function handleVersionUpdate(data) {
  console.log('[Renderer] handleVersionUpdate data:', JSON.stringify(data, null, 2));
  // Используем newProductVersion или формируем версию на основе newVersion
  productVersion = data.newProductVersion || `1.0.72.180 v ${data.newVersion}` || 'Unknown';
  elements.versionNumber.textContent = productVersion;
  elements.newVersionInfo.style.display = 'none';
  elements.stageTitle.textContent = 'Update completed';
  elements.progressBar.style.width = '100%';
  elements.playBtn.disabled = false;
  showNotification('success', MESSAGES.SUCCESS.UPDATE_SUCCESS);
}

function handleVerificationComplete(data) {
  console.log('[Renderer] handleVerificationComplete data:', JSON.stringify(data, null, 2));
  if (data.missingCount > 0 || data.modifiedCount > 0) {
    showNotification('warning', `Found ${data.missingCount} missing and ${data.modifiedCount} modified files.`);
    elements.stageTitle.textContent = 'Verification completed';
    elements.playBtn.disabled = true; // Оставляем кнопку отключённой до update-summary
  } else {
    showNotification('success', MESSAGES.SUCCESS.VERIFICATION_SUCCESS);
    elements.stageTitle.textContent = 'Verification completed';
    elements.playBtn.disabled = true; // Оставляем кнопку отключённой до update-summary
  }
}

function handleUpdateSummary(data) {
  console.log('[Renderer] handleUpdateSummary data:', JSON.stringify(data, null, 2));
  if (data.failCount > 0) {
    showNotification('error', `${MESSAGES.ERRORS.UPDATE_FAILED} (${data.failCount} files)`);
    elements.stageTitle.textContent = 'Update failed';
    elements.playBtn.disabled = false;
  } else if (data.totalFiles > 0) {
    showNotification('success', MESSAGES.SUCCESS.UPDATE_SUCCESS);
    elements.stageTitle.textContent = 'Update completed';
    elements.playBtn.disabled = false;
  } else {
    showNotification('info', MESSAGES.SUCCESS.NO_UPDATES);
    elements.stageTitle.textContent = 'Client is up to date';
    elements.progressBar.style.width = '100%';
    elements.playBtn.disabled = false;
  }
}

function handleError(data) {
  console.log('[Renderer] handleError data:', JSON.stringify(data, null, 2));
  let errorMsg = data.error?.message || data.error || 'Unknown error';
  let userFriendlyMsg = MESSAGES.ERRORS.UNKNOWN_ERROR;

  if (errorMsg.includes('Version.ini не найден')) {
    userFriendlyMsg = MESSAGES.ERRORS.VERSION_NOT_FOUND;
  } else if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
    userFriendlyMsg = MESSAGES.ERRORS.NO_CONNECTION;
  } else if (errorMsg.includes('ENOENT') || errorMsg.includes('no such file')) {
    userFriendlyMsg = MESSAGES.ERRORS.FILE_MISSING;
  }

  showNotification('error', userFriendlyMsg);
  elements.stageTitle.textContent = 'Error occurred';
  elements.playBtn.disabled = false;
}

function showErrorNotification(error) {
  console.log('[Renderer] showErrorNotification error:', error);
  let message = error;
  
  if (error.includes('Version.ini не найден')) {
    message = MESSAGES.ERRORS.VERSION_NOT_FOUND;
  } else if (error.includes('ECONNREFUSED') || error.includes('fetch failed')) {
    message = MESSAGES.ERRORS.NO_CONNECTION;
  } else if (error.includes('ENOENT') || error.includes('no such file')) {
    message = MESSAGES.ERRORS.FILE_MISSING;
  }
  
  showNotification('error', message);
  elements.stageTitle.textContent = 'Error occurred';
  elements.playBtn.disabled = false;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Renderer] DOMContentLoaded, initializing...');
  setupEventListeners();
  fetchInitialVersion();
});