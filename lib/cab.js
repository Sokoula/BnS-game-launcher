"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process"); // Changed from spawnSync to spawn
const { app } = require('electron');

// Правильный путь к elzma.exe в зависимости от режима
function getElzmaPath() {
    if (app.isPackaged) {
        // В релизном режиме: resources/bin/elzma.exe
        return path.join(path.dirname(process.execPath), "resources", "bin", "elzma.exe");
    } else {
        // В dev режиме: lib/bin/elzma.exe
        return path.resolve(__dirname, "bin", "elzma.exe");
    }
}

module.exports = {
    async compress(file, options) { // Made async
        const inputFile = path.resolve(file);
        let outputFile = path.resolve(`${file}.cab`);

        ({ "deleteFile": false, "overwrite": true, "outputFile": null, "outputDirectory": null, ...options });

        if (!fs.existsSync(inputFile))
            throw `Input file "${inputFile}" is not exists`;

        if (options.outputDirectory)
            outputFile = path.join(options.outputDirectory, path.basename(outputFile));

        if (options.outputFile)
            outputFile = path.resolve(options.outputFile);

        if (options.overwrite || !fs.existsSync(outputFile))
            await this._spawnProcess("compress", inputFile, outputFile); // Await async spawn

        if (options.deleteFile)
            fs.unlinkSync(inputFile);
    },

    async decompress(file, options) { // Made async
        const inputFile = path.resolve(file);
        let outputFile = path.resolve(file.replace(/\.cab$/g, ""));

        ({ "deleteFile": false, "overwrite": true, "outputFile": null, "outputDirectory": null, ...options });

        if (!fs.existsSync(inputFile))
            throw `Input file "${inputFile}" is not exists`;

        if (options.outputDirectory)
            outputFile = path.join(options.outputDirectory, path.basename(outputFile));

        if (options.outputFile)
            outputFile = path.resolve(options.outputFile);

        if (options.overwrite || !fs.existsSync(outputFile))
            await this._spawnProcess("decompress", inputFile, outputFile); // Await async spawn

        if (options.deleteFile)
            fs.unlinkSync(inputFile);
    },

    /**
     * Private functions
     */
    async _spawnProcess(flag, inputFile, outputFile) { // Made async
        return new Promise((resolve, reject) => {
            const elzmaPath = getElzmaPath();
            console.log(`[Cab] Using elzma path: ${elzmaPath}`);
            
            const args = [...(flag === "compress" ? ["--compress", "-9", "-s", 26] : ["--decompress"]), "-f", "-k", "--lzma", inputFile, outputFile];
            
            const child = spawn(elzmaPath, args, {
                "cwd": process.cwd(),
                "env": process.env,
                "stdio": "pipe"
            });

            let stderr = '';
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Process exited with code ${code}`));
                } else if (stderr.length !== 0 && stderr !== "null") {
                    reject(new Error(`Error in ${flag}: ${stderr}`));
                } else {
                    resolve();
                }
            });

            child.on('error', (err) => {
                reject(new Error(`Process error: ${err.message}`));
            });
        });
    }
};