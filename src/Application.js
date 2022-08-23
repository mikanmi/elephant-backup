/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
 "use strict"

import * as fsPromises from 'node:fs/promises';
import * as readline from 'node:readline';

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

        // calculate the starting position of the file to read.
        // return immediately if the size variable is shorter than the size of the file.
        let stats;
        try {
            stats = await fsPromises.lstat(filePath);
        }
        catch {
            return;
        }
        const startPositionOnRead = stats.size - size;
        if (startPositionOnRead <= 0) {
            return;
        }

        // move the file to a temporary file.
        const temporaryFilePath = filePath + '.temp';
        fsPromises.rename(filePath, temporaryFilePath);

        // copy the content of the temporary file with the starting position to the file.
        const readHandle = await fsPromises.open(temporaryFilePath, 'r');
        const readStream = readHandle.createReadStream({start: startPositionOnRead});
        const readLine = readline.createInterface({
            input: readStream,
            crlfDelay: Infinity
        });

        let found = false;
        const writeHandle = await fsPromises.open(filePath, 'w');
        for await (const line of readLine) {
            if (found) {
                await writeHandle.appendFile(line + '\n');
                continue;
            }
            if (line.includes(Configure.LOG_START_SENTENCE)) {
                found = true;
                await writeHandle.appendFile(line + '\n');
            }
        }

        readStream.close();
        readHandle.close();
        writeHandle.close();

        // remove the temporary file.
        await fsPromises.rm(temporaryFilePath);
    }
}
 