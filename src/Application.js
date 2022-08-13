/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
 "use strict"

import process from 'node:process';
import * as fs from 'node:fs';

import { Logger, LogLevel } from './Logger.js';
import { Options } from './Options.js';
import { Subcommand } from './Subcommand.js';
import { Configure } from './Configure.js';
 
 const logger = Logger.getLogger();
 
export class Application {

    constructor() {
        const commandLine = Options.getInstance();
        commandLine.configure();
        commandLine.parse();

        const logFile = fs.createWriteStream(Configure.LOG_FILE_PATH);
        logger.addConsole(logFile);
    }

    async start() {
        const commandLine = Options.getInstance();
        if (commandLine.options.verbose) {
            logger.setLogLevel(LogLevel.DEBUG);
        }

        logger.print(`===== Start Elephant Backup =====`);
        logger.debug(process.argv);
    
        logger.info(`Subcommand: ${commandLine.subcommand}`);
        logger.info(`options => `);
        logger.info(commandLine.options);
        logger.info(`targets: ${commandLine.targets}`);

        const subcommand = Subcommand.create(commandLine.subcommand);
        await subcommand.run();
    }
}
 