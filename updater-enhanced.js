"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const ini = require("ini");
const sqlite3 = require("sqlite3").verbose();
const cab = require("./lib/cab");
const md5File = require("md5-file");
const progressEvents = require("./progress-events");
const {
    app
} = require("electron");

class BnSEnhancedUpdater {
    constructor(config = {}) {
        // Определяем базовый путь в зависимости от режима
        const basePath = app.isPackaged ? path.dirname(process.execPath) : __dirname;

        this.config = {
            clientDirectory: basePath,
            patchServerUrl: "http://192.168.0.114:3000/bns-patch",
            versionFile: path.join(basePath, "bin", "Version.ini"),
            tempDirectory: path.join(basePath, "temp"),
            maxRetries: 3,
            retryDelay: 1000,
            ...config
        };

        if (!fs.existsSync(this.config.tempDirectory)) {
            fs.mkdirSync(this.config.tempDirectory, {
                recursive: true
            });
        }

        console.log(`[Config] process.cwd(): ${process.cwd()}`);
        console.log(`[Config] clientDirectory: ${this.config.clientDirectory}`);
        console.log(`[Config] versionFile path: ${this.config.versionFile}`);
        console.log(`[Config] app.isPackaged: ${app.isPackaged}`);
        console.log(`[Config] __dirname: ${__dirname}`);
        console.log(`[Config] basePath: ${basePath}`);
    }

    async checkForUpdates(fullCheck = false) {
        try {
            const localVersion = this.getLocalVersion();
            console.log(`\x1b[37m[VersionCheck] Client Version: \x1b[33m${localVersion}\x1b[0m`);

            const remoteVersionInfo = await this.getRemoteVersionInfo();
            console.log(`\x1b[37m[VersionCheck] Server Version: \x1b[33m${remoteVersionInfo.version}\x1b[0m`);

            progressEvents.emitVersionCheck(localVersion, remoteVersionInfo.version);

            const allRequiredFiles = await this.getAllRequiredFilesInfo(remoteVersionInfo.version);

            // Добавляем задержку 3 секунды перед проверкой файлов, если есть обновление или полная проверка
            if (remoteVersionInfo.version > localVersion || fullCheck) {
                console.log(`\x1b[37m[UpdateCheck] Waiting 3 seconds before proceeding with file verification...\x1b[0m`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            const {
                missingFiles,
                modifiedFiles
            } = await this.verifyClientFiles(allRequiredFiles);

            // Формируем уникальный список файлов для обновления
            const fileMap = new Map();

            // Добавляем файлы для обновления версии, если требуется
            if (remoteVersionInfo.version > localVersion) {
                const versionFiles = await this.getVersionUpdateFiles(localVersion, remoteVersionInfo.version);
                for (const file of versionFiles) {
                    fileMap.set(file.id, file);
                }
            }

            // Добавляем отсутствующие файлы
            for (const file of missingFiles) {
                fileMap.set(file.id, file);
            }

            // Добавляем изменённые файлы
            for (const file of modifiedFiles) {
                fileMap.set(file.id, file);
            }

            const filesToUpdate = [...fileMap.values()];

            if (remoteVersionInfo.version > localVersion || filesToUpdate.length > 0) {
                console.log(`\x1b[37m[UpdateCheck] \x1b[32mUpdate Available!\x1b[0m`);
                return {
                    updateAvailable: true,
                    currentVersion: localVersion,
                    newVersion: remoteVersionInfo.version,
                    filesToUpdate,
                    dbFile: remoteVersionInfo.dbFile,
                    isRepair: remoteVersionInfo.version === localVersion
                };
            } else {
                console.log(`\x1b[37m[UpdateCheck] \x1b[32mClient is up to date. No update needed.\x1b[0m`);
                await this.cleanTempDirectory();
                progressEvents.emitUpdateSummary(0, 0, 0);
                return {
                    updateAvailable: false,
                    currentVersion: localVersion
                };
            }
        } catch (error) {
            await this.cleanTempDirectory();
            console.error(`\x1b[31m[UpdateCheck] Error checking for updates: ${error}\x1b[0m`);
            progressEvents.emitError('check', error);
            throw error;
        }
    }

    async verifyClientFiles(allRequiredFiles) {
        const missingFiles = [];
        const modifiedFiles = [];
        const totalFiles = allRequiredFiles.length;
        let checkedFiles = 0;

        console.log(`\x1b[37m[FileVerification] Verifying \x1b[33m${totalFiles}\x1b[37m client files...\x1b[0m`);
        progressEvents.emitVerificationStart(totalFiles);

        for (const file of allRequiredFiles) {
            checkedFiles++;
            console.log(`\x1b[37m[FileVerification] Checking (\x1b[33m${checkedFiles}\x1b[37m / \x1b[33m${totalFiles}\x1b[37m): ${file.destination}\x1b[0m`);
            progressEvents.emitVerificationProgress(checkedFiles, totalFiles, file.destination);

            try {
                const localFile = path.join(this.config.clientDirectory, file.destination);

                if (!fs.existsSync(localFile)) {
                    missingFiles.push(file);
                    continue;
                }

                const localHash = await md5File(localFile);
                if (localHash !== file.hash) {
                    modifiedFiles.push(file);
                }
            } catch (error) {
                console.error(`\x1b[31m[FileVerification] Error checking file ${file.destination}: ${error}\x1b[0m`);
                modifiedFiles.push(file);
            }
        }

        if (missingFiles.length > 0) {
            console.log(`\x1b[37m[FileVerification] Missing files detected: \x1b[33m${missingFiles.length}\x1b[0m`);
        }
        if (modifiedFiles.length > 0) {
            console.log(`\x1b[37m[FileVerification] Modified files detected: \x1b[33m${modifiedFiles.length}\x1b[0m`);
        }

        progressEvents.emitVerificationComplete(missingFiles.length, modifiedFiles.length);
        return {
            missingFiles,
            modifiedFiles
        };
    }

    async getAllRequiredFilesInfo(targetVersion) {
        const files = [];
        const tempFiles = [];

        for (let version = 1; version <= targetVersion; version++) {
            const tempDbPath = path.join(this.config.tempDirectory, `server.db.${version}`);
            const tempDbCab = `${tempDbPath}.cab`;

            try {
                console.log(`\x1b[37m[Database] Downloading database version \x1b[33m${version}\x1b[37m...\x1b[0m`);
                await this.downloadFile(`${this.config.patchServerUrl}/db/server.db.${version}.cab`, tempDbCab);

                console.log(`\x1b[37m[Database] Extracting database for version \x1b[33m${version}\x1b[37m...\x1b[0m`);
                try {
                    await cab.decompress(tempDbCab, {
                        outputFile: tempDbPath
                    });
                } catch (error) {
                    console.error(`\x1b[31m[Database] Failed to decompress database for version ${version}: ${error.message}\x1b[0m`);
                    continue;
                }

                tempFiles.push({
                    tempDbPath,
                    tempDbCab
                });

                const db = new sqlite3.Database(tempDbPath);
                try {
                    console.log(`\x1b[37m[Database] Getting required files info for version \x1b[33m${version}\x1b[37m...\x1b[0m`);
                    const versionFiles = await new Promise((resolve, reject) => {
                        db.all(`
                            SELECT fi.id, fi.path, fv.version, fv.hash 
                            FROM file_info fi
                            JOIN file_version fv ON fi.id = fv.id
                            WHERE fv.version <= ?
                            AND fv.version = (
                                SELECT MAX(version) 
                                FROM file_version 
                                WHERE id = fi.id AND version <= ?
                            )
                            ORDER BY fi.id
                        `, [version, version], (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows);
                        });
                    });

                    for (const file of versionFiles) {
                        files.push({
                            url: `${this.config.patchServerUrl}/patch/${file.id}-${file.version}.cab`,
                            destination: file.path,
                            version: file.version,
                            hash: file.hash,
                            id: file.id
                        });
                    }
                } finally {
                    db.close();
                }
            } catch (error) {
                console.error(`\x1b[31m[Database] Error processing database for version ${version}: ${error}\x1b[0m`);
            } finally {
                if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
                if (fs.existsSync(tempDbCab)) fs.unlinkSync(tempDbCab);
            }
        }

        const uniqueFiles = [];
        const fileMap = new Map();

        for (const file of files) {
            const existing = fileMap.get(file.id);
            if (!existing || existing.version < file.version) {
                fileMap.set(file.id, file);
            }
        }

        uniqueFiles.push(...fileMap.values());

        return uniqueFiles;
    }

    async getVersionUpdateFiles(currentVersion, newVersion) {
        const files = [];
        const tempDbPath = path.join(this.config.tempDirectory, `server.db.${newVersion}`);
        const tempDbCab = `${tempDbPath}.cab`;

        try {
            console.log(`\x1b[37m[Database] Downloading database version \x1b[33m${newVersion}\x1b[37m...\x1b[0m`);
            await this.downloadFile(`${this.config.patchServerUrl}/db/server.db.${newVersion}.cab`, tempDbCab);

            console.log(`\x1b[37m[Database] Extracting database...\x1b[0m`);
            try {
                await cab.decompress(tempDbCab, {
                    outputFile: tempDbPath
                });
            } catch (error) {
                console.error(`\x1b[31m[Database] Failed to decompress database for version ${newVersion}: ${error.message}\x1b[0m`);
                throw error;
            }

            const db = new sqlite3.Database(tempDbPath);
            try {
                console.log(`\x1b[37m[Database] Analyzing changed files...\x1b[0m`);
                const changedFiles = await new Promise((resolve, reject) => {
                    db.all(`
                        SELECT fi.id, fi.path, fv.version, fv.hash 
                        FROM file_info fi
                        JOIN file_version fv ON fi.id = fv.id
                        WHERE fv.version > ?
                        ORDER BY fi.id
                    `, [currentVersion], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });

                for (const file of changedFiles) {
                    files.push({
                        url: `${this.config.patchServerUrl}/patch/${file.id}-${file.version}.cab`,
                        destination: file.path,
                        version: file.version,
                        hash: file.hash,
                        id: file.id
                    });
                }
            } finally {
                db.close();
            }
        } catch (error) {
            console.error(`\x1b[31m[Database] Error processing database for version ${newVersion}: ${error}\x1b[0m`);
            throw error;
        } finally {
            if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
            if (fs.existsSync(tempDbCab)) fs.unlinkSync(tempDbCab);
        }

        return files;
    }

    async applyUpdates(updateInfo) {
        if (!updateInfo.updateAvailable) {
            console.log(`\x1b[37m[Update] No updates to apply.\x1b[0m`);
            return;
        }

        try {
            if (updateInfo.isRepair) {
                console.log(`\x1b[37m[Update] Starting client repair for version \x1b[33m${updateInfo.currentVersion}\x1b[37m...\x1b[0m`);
            } else {
                console.log(`\x1b[37m[Update] Starting update to version \x1b[33m${updateInfo.newVersion}\x1b[37m...\x1b[0m`);
            }

            const totalFiles = updateInfo.filesToUpdate.length;
            console.log(`\x1b[37m[Update] Found \x1b[33m${totalFiles}\x1b[37m files to process\x1b[0m`);

            console.log(`\x1b[37m[Download] Downloading all update files...\x1b[0m`);
            const tempFiles = [];

            let totalBytes = 0;
            let downloadedBytes = 0;
            let startTime = Date.now();
            let lastEmittedTime = startTime;
            let downloadedFiles = 0;

            progressEvents.emitDownloadStart(totalFiles);

            for (const file of updateInfo.filesToUpdate) {
                try {
                    const size = await this.getRemoteFileSize(file.url);
                    totalBytes += size;
                } catch (error) {
                    console.error(`\x1b[31m[Download] Error getting size for ${file.url}: ${error}\x1b[0m`);
                }
            }

            for (const file of updateInfo.filesToUpdate) {
                downloadedFiles++;
                const tempFile = path.join(this.config.tempDirectory, path.basename(file.url));
                const statusMsg = `Downloading`;
                console.log(`\x1b[37m[Download] ${statusMsg} (\x1b[33m${downloadedFiles}\x1b[37m / \x1b[33m${totalFiles}\x1b[37m): ${file.destination}\x1b[0m`);

                await this.downloadFile(file.url, tempFile, (bytesDownloaded, fileSize) => {
                    downloadedBytes += bytesDownloaded;
                    const currentTime = Date.now();
                    if (currentTime - lastEmittedTime > 100) {
                        const elapsedTime = (currentTime - startTime) / 1000;
                        const speed = elapsedTime > 0 ? downloadedBytes / elapsedTime : 0;
                        const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;

                        progressEvents.emitDownloadProgress(
                            percent,
                            downloadedBytes,
                            totalBytes,
                            speed,
                            file.destination
                        );
                        lastEmittedTime = currentTime;
                    }
                });

                tempFiles.push({
                    tempPath: tempFile,
                    destination: path.join(this.config.clientDirectory, file.destination),
                    hash: file.hash
                });
            }

            progressEvents.emitDownloadComplete();

            console.log(`\x1b[37m[Extract] Extracting all files (\x1b[33m${totalFiles}\x1b[37m total)...\x1b[0m`);
            let extractedCount = 0;
            progressEvents.emitExtractStart(totalFiles);

            for (const file of tempFiles) {
                extractedCount++;
                try {
                    const destinationDir = path.dirname(file.destination);
                    if (!fs.existsSync(destinationDir)) {
                        fs.mkdirSync(destinationDir, {
                            recursive: true
                        });
                    }

                    const displayPath = file.destination.replace(this.config.clientDirectory, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
                    console.log(`\x1b[37m[Extract] Extracting (\x1b[33m${extractedCount}\x1b[37m / \x1b[33m${totalFiles}\x1b[37m): ${displayPath}\x1b[0m`);
                    await cab.decompress(file.tempPath, {
                        outputFile: file.destination,
                        overwrite: true
                    });
                    progressEvents.emitExtractProgress(extractedCount, totalFiles, file.destination);
                } catch (error) {
                    console.error(`\x1b[31m[Extract] Error extracting file ${file.destination.replace(this.config.clientDirectory, '')}: ${error}\x1b[0m`);
                    progressEvents.emitError('extract', error);
                }
            }

            progressEvents.emitExtractComplete();

            console.log(`\x1b[37m[Verify] Verifying all files (\x1b[33m${totalFiles}\x1b[37m total)...\x1b[0m`);
            let successCount = 0;
            let failCount = 0;
            let verifiedCount = 0;

            for (const file of tempFiles) {
                verifiedCount++;
                try {
                    if (fs.existsSync(file.destination)) {
                        const localHash = await md5File(file.destination);
                        if (localHash === file.hash) {
                            console.log(`\x1b[37m[Verify] \x1b[32mOK\x1b[37m (\x1b[33m${verifiedCount}\x1b[37m / \x1b[33m${totalFiles}\x1b[37m) Verification successful for ${file.destination.replace(this.config.clientDirectory, '')}\x1b[0m`);
                            successCount++;
                        } else {
                            console.error(`\x1b[31m[Verify] FAIL\x1b[37m (\x1b[33m${verifiedCount}\x1b[37m / \x1b[33m${totalFiles}\x1b[37m) Hash mismatch for ${file.destination.replace(this.config.clientDirectory, '')}\x1b[0m`);
                            failCount++;
                        }
                    } else {
                        console.error(`\x1b[31m[Verify] FAIL\x1b[37m (\x1b[33m${verifiedCount}\x1b[37m / \x1b[33m${totalFiles}\x1b[37m) File missing: ${file.destination.replace(this.config.clientDirectory, '')}\x1b[0m`);
                        failCount++;
                    }
                } catch (error) {
                    console.error(`\x1b[31m[Verify] Error verifying file ${file.destination.replace(this.config.clientDirectory, '')}: ${error}\x1b[0m`);
                    failCount++;
                    progressEvents.emitError('verify', error);
                } finally {
                    if (fs.existsSync(file.tempPath)) fs.unlinkSync(file.tempPath);
                }
            }

            if (!updateInfo.isRepair && updateInfo.dbFile) {
                const tempDbPath = path.join(this.config.tempDirectory, "server.db");
                const tempDbCab = path.join(this.config.tempDirectory, path.basename(updateInfo.dbFile));

                await this.downloadFile(`${this.config.patchServerUrl}/${updateInfo.dbFile}`, tempDbCab);
                await cab.decompress(tempDbCab, {
                    outputFile: tempDbPath
                });

                if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
                if (fs.existsSync(tempDbCab)) fs.unlinkSync(tempDbCab);

                this.updateLocalVersion(updateInfo.newVersion);
            }

            console.log(`\x1b[37m[Summary] Update summary:\x1b[0m`);
            console.log(`\x1b[37m- Total files processed: \x1b[33m${totalFiles}\x1b[0m`);
            console.log(`\x1b[37m- Successfully updated: \x1b[32m${successCount}\x1b[0m`);
            console.log(`\x1b[37m- Failed updates: \x1b[31m${failCount}\x1b[0m`);

            progressEvents.emitUpdateSummary(totalFiles, successCount, failCount);

            if (updateInfo.isRepair) {
                console.log(`\x1b[37m[Update] \x1b[32mClient repair completed!\x1b[0m`);
                if (failCount > 0) {
                    console.log(`\x1b[33m[Update] Warning: Some files could not be repaired. You may need to reinstall the client.\x1b[0m`);
                }
            } else {
                console.log(`\x1b[37m[Update] \x1b[32mUpdate completed successfully!\x1b[0m`);
                console.log(`\x1b[37m[Update] Client updated to version \x1b[33m${updateInfo.newVersion}\x1b[0m`);
                progressEvents.emitVersionUpdate(updateInfo.newVersion);
            }

        } catch (error) {
            console.error(`\x1b[31m[Update] Error during update: ${error}\x1b[0m`);
            progressEvents.emitError('update', error);
            throw error;
        } finally {
            await this.cleanTempDirectory();
        }
    }

    async getRemoteFileSize(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;

            protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    return reject(new Error(`Failed to get file size (Status: ${response.statusCode})`));
                }
                resolve(parseInt(response.headers['content-length'], 10));
            }).on('error', (err) => {
                reject(new Error(`Connection error: ${err.message}`));
            });
        });
    }

    async downloadFile(url, destination, progressCallback) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            const file = fs.createWriteStream(destination);

            protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(destination, () => {});
                    return reject(new Error(`Download failed (Status: ${response.statusCode})`));
                }

                const totalBytes = parseInt(response.headers['content-length'], 10);
                let downloadedBytes = 0;

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    if (progressCallback) {
                        progressCallback(chunk.length, totalBytes);
                    }
                });

                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }).on('error', (err) => {
                file.close();
                fs.unlinkSync(destination, () => {});
                reject(new Error(`Download error: ${err.message}`));
            });
        });
    }

    getLocalVersion() {
        console.log(`[VersionCheck] Checking Version.ini at: ${this.config.versionFile}`);
        const possiblePaths = [
            this.config.versionFile,
            path.join(this.config.clientDirectory, "BIN/Version.ini"),
            path.join(this.config.clientDirectory, "Version.ini"),
            path.join(__dirname, "bin/Version.ini"),
            path.join(__dirname, "BIN/Version.ini")
        ];

        let foundPath = null;
        for (const p of possiblePaths) {
            console.log(`[VersionCheck] Trying path: ${p}`);
            if (fs.existsSync(p)) {
                foundPath = p;
                break;
            }
        }

        if (!foundPath) {
            console.error(`[VersionCheck] Version.ini not found at any of these paths:`, possiblePaths);
            throw new Error("Version.ini not found in client directory");
        }

        const versionData = ini.decode(fs.readFileSync(foundPath, "utf-8"));
        const version = parseInt(versionData.Download.Version) || 0;
        console.log(`[VersionCheck] Contents of Version.ini:`, versionData);
        this.config.versionFile = foundPath;
        return version;
    }

    async getRemoteVersionInfo() {
        const url = `${this.config.patchServerUrl}/Version.ini`;
        console.log(`[VersionCheck] Downloading Version.ini from server: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download Version.ini (Status: ${response.status})`);
            }
            const data = await response.text();
            const versionData = ini.decode(data);
            console.log(`[VersionCheck] Contents of Version.ini from server:`, versionData);
            return {
                version: parseInt(versionData.Download.Version),
                dbFile: versionData.Download["DB file"]
            };
        } catch (error) {
            console.error(`[VersionCheck] Error downloading version info:`, error);
            throw error;
        }
    }

    updateLocalVersion(newVersion) {
        try {
            const versionData = ini.decode(fs.readFileSync(this.config.versionFile, "utf-8"));

            if (versionData.Version && versionData.Version.ProductVersion) {
                const currentProductVersion = versionData.Version.ProductVersion.split(' v ')[0];
                versionData.Version.ProductVersion = `${currentProductVersion} v ${newVersion}`;
            }

            versionData.Download.Version = newVersion.toString();
            versionData.Download["DB file"] = `db/server.db.${newVersion}.cab`;

            fs.writeFileSync(this.config.versionFile, ini.encode(versionData));
            console.log(`\x1b[37m[VersionUpdate] Version.ini updated successfully\x1b[0m`);

            const updatedData = ini.decode(fs.readFileSync(this.config.versionFile, "utf-8"));
            console.log(`\x1b[37m[VersionUpdate] Version verification:\x1b[0m`);
            console.log(`\x1b[37m- ProductVersion: ${updatedData.Version?.ProductVersion || 'N/A'}\x1b[0m`);
            console.log(`\x1b[37m- Download Version: ${updatedData.Download.Version}\x1b[0m`);
        } catch (error) {
            console.error(`\x1b[31m[VersionUpdate] Error updating Version.ini: ${error}\x1b[0m`);
            throw error;
        }
    }

    async cleanTempDirectory() {
        try {
            if (!fs.existsSync(this.config.tempDirectory)) {
                return;
            }

            const files = await fs.promises.readdir(this.config.tempDirectory);
            for (const file of files) {
                const filePath = path.join(this.config.tempDirectory, file);
                try {
                    await fs.promises.unlink(filePath);
                } catch (err) {
                    console.log(`\x1b[33m[Cleanup] Could not delete temp file ${file}: ${err.message}\x1b[0m`);
                }
            }

            if (files.length === 0) {
                await fs.promises.rmdir(this.config.tempDirectory);
            }

            console.log(`\x1b[37m[Cleanup] Temp directory cleaned\x1b[0m`);
        } catch (err) {
            console.log(`\x1b[33m[Cleanup] Error cleaning temp directory: ${err.message}\x1b[0m`);
        }
    }
}

module.exports = BnSEnhancedUpdater;

if (require.main === module) {
    if (process.send) {
        const originalEmit = progressEvents.emit;
        progressEvents.emit = function(event, ...args) {
            process.send({
                type: event,
                data: args[0]
            });
            originalEmit.apply(progressEvents, [event, ...args]);
        };

        process.on('uncaughtException', (err) => {
            process.send({
                type: 'error',
                data: {
                    stage: 'uncaught',
                    error: err.message
                }
            });
        });
    }

    (async () => {
        try {
            const updater = new BnSEnhancedUpdater();
            const updateInfo = await updater.checkForUpdates();

            if (updateInfo.updateAvailable) {
                await updater.applyUpdates(updateInfo);
            }
        } catch (error) {
            console.error(`\x1b[31m[Critical] Critical error: ${error.message}\x1b[0m`);
            if (process.send) {
                process.send({
                    type: 'error',
                    data: {
                        stage: 'critical',
                        error: error.message
                    }
                });
            }
            process.exit(1);
        }
    })();
}