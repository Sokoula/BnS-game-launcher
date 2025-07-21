"use strict";

const EventEmitter = require('events');

class ProgressEvents extends EventEmitter {
    constructor() {
        super();
    }

    // File Verification Events
    emitVerificationStart(totalFiles) {
    this.emit('verification-start', { totalFiles });
    }

    emitVerificationProgress(current, total, filePath) {
        const percent = Math.round((current / total) * 100);
        this.emit('verification-progress', { current, total, percent, filePath });
    }

    emitVerificationComplete(missingCount, modifiedCount) {
        this.emit('verification-complete', { missingCount, modifiedCount });
    }

    // Download Events
    emitDownloadStart(totalFiles) {
        this.emit('download-start', { totalFiles });
    }

    emitDownloadProgress(percent, downloadedBytes, totalBytes, speed, filePath) {
        const speedMb = (speed / (1024 * 1024)).toFixed(2);
        this.emit('download-progress', { 
            percent,
            downloadedBytes,
            totalBytes,
            speed: speedMb,
            filePath
        });
    }

    emitDownloadComplete() {
        this.emit('download-complete');
    }

    // Extraction Events
    emitExtractStart(totalFiles) {
        this.emit('extract-start', { totalFiles });
    }

    emitExtractProgress(current, total, filePath) {
        const percent = Math.round((current / total) * 100);
        this.emit('extract-progress', { current, total, percent, filePath });
    }

    emitExtractComplete() {
        this.emit('extract-complete');
    }

    // Version Events
    emitVersionCheck(localVersion, remoteVersion) {
        this.emit('version-check', { localVersion, remoteVersion });
    }

    emitVersionUpdate(newVersion) {
        this.emit('version-update', { newVersion });
    }

    // Summary Events
    emitUpdateSummary(totalFiles, successCount, failCount) {
        this.emit('update-summary', { totalFiles, successCount, failCount });
    }

    // Error Events
    emitError(stage, error) {
        this.emit('error', { stage, error });
    }
}

module.exports = new ProgressEvents();