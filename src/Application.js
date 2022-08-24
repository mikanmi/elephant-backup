/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
 "use strict"

import * as fsPromises from 'node:fs/promises';

import { Logger, LogLevel } from './Logger.js';
import { Options } from './Options.js';
import { Subcommand } from './Subcommand.js';
import { Configure } from './Configure.js';

const logger = Logger.getLogger();
 
export class Application {

    constructor() {
        const options = Options.getInstance();
        options.configure();
        options.parse();
    }

    async start() {
        await this.#truncateHeadOfFile(Configure.LOG_FILE_PATH, Configure.LOG_FILE_SIZE);

        const logHandle = await fsPromises.open(Configure.LOG_FILE_PATH, 'as');
        const logWriteStream = logHandle.createWriteStream();

        logger.addConsole(logWriteStream);

        const options = Options.getInstance();
        if (options.options.verbose) {
            logger.setLogLevel(LogLevel.DEBUG);
        }

        // Print the first sentence, 'Start Elephant Backup'.
        logger.print(Configure.LOG_START_SENTENCE);
        logger.debug(process.argv);
    
        logger.info(`Subcommand: ${options.subcommand}`);
        logger.info(`options => `);
        logger.info(options.options);
        logger.info(`targets: ${options.targets}`);

        const subcommand = Subcommand.create(options.subcommand);
        await subcommand.run();
    }

    /**
     * Truncate the head of file.
     * @param {string} filePath 
     * @param {number} size 
     */
     async #truncateHeadOfFile(filePath, size) {

        let fileHandle;
        try {
            fileHandle = await fsPromises.open(filePath, 'r+');
        }
        catch {
            // return if the file dose not exist.
            return;
        }

        // calculate the starting position to read the file.
        const stat = await fileHandle.stat()
        const startPositionOnRead = stat.size - size;
        if (startPositionOnRead <= 0) {
            // return immediately if the size variable is shorter than the file size.
            return;
        }

        let seeking = true;
        const buffer = new Uint8Array(16 * 1024); // 16K bytes
        let readingPosition = startPositionOnRead;
        let writingPosition = 0;
        // NOSONAR
        for (;;) { 
            const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, readingPosition);
            if (bytesRead == 0) {
                // complete moving the log messages from the read-position to zero-position.
                break;
            }
            if (seeking) {
                const logPosition = this.#findLogPosition(buffer);
                if (logPosition) {
                    // start transporting the log
                    readingPosition += logPosition;
                    seeking = false;
                    continue;
                }
            }
            readingPosition += bytesRead;

            if (!seeking) {
                const { bytesWritten } = await fileHandle.write(buffer, 0, buffer.length, writingPosition);
                if (bytesWritten != bytesRead) {
                    throw new Error('Writing to the log file is failed while truncating it.');
                }
            }
        }

        await fsPromises.truncate(filePath, size);
    }

    /**
     * Find the first single log on the multiple log records.
     * 
     * @param {Uint8Array} log a raw array of log file.
     * @returns zero or positive values of start-position if found, otherwise false. 
     */
    #findLogPosition(log) {
        let found = undefined;

        const utf8Encode = new TextEncoder();
        const sentence = utf8Encode.encode(Configure.LOG_START_SENTENCE);
        let finding = 0;

        for (let index = 0; index < log.length; index++) {
            const character = log[index];
            if (character == sentence[finding]) {
                finding++;
                if (finding == sentence.length) {
                    found = index;
                    break;
                }
            }
        }
        return found;
    }
}
 