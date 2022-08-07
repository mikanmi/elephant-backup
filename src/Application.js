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
import { CommandLine } from './CommandLine.js';
import { Subcommand } from './Subcommand.js';
import { ZfsUtilities } from './ZfsUtilities.js';
import { Configure } from './Configure.js';
 
 const logger = Logger.getLogger();
 
export class Application {

    constructor() {
        const commandLine = CommandLine.getInstance();
        commandLine.configure();
        commandLine.parse();

        const logFile = fs.createWriteStream(Configure.LOG_FILE_PATH);
        logger.addConsole(logFile);
    }

    async start() {
        const commandLine = CommandLine.getInstance();
        if (commandLine.options.verbose) {
            logger.setLogLevel(LogLevel.DEBUG);
        }

        logger.print(`===== Start Elephant Backup =====`);
        logger.debug(process.argv);
    
        logger.info(`Subcommand: ${commandLine.subcommand}`);
        logger.info(`options => `);
        logger.info(commandLine.options);
        logger.info(`targets: ${commandLine.targets}`);

        await this.#exist();

        const subcommand = Subcommand.create(commandLine.subcommand);
        subcommand.run();
    }

    async #exist() {
        const commandLine = CommandLine.getInstance();

        const targets = commandLine.targets;
        const options = commandLine.options;

        if (!commandLine.options.dryRun && !ZfsUtilities.isSuperUser()) {
            // run the diff Subcommand of Elephant Backup on a normal user.
            logger.exit(`Run the ${commandLine.subcommand} on the SUPER user.`);
        }

        // exit if the specified ZFS filesystems do not exist on the machine.
        const list = await ZfsUtilities.filesystemList();
        if (!list.includes(options.archive)) {
            logger.exit(`An archive ZFS pool/dataset is not exist: ${options.archive}`);
        }
        for (const target of targets) {
            if (!list.includes(target)) {
                logger.exit(`A primary ZFS pool/dataset is not exist: ${target}`);
            }
        }

    }
}
 