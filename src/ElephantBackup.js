/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
 "use strict"

import path from 'node:path';
import * as fsPromises from 'node:fs/promises';

import { Logger, LogLevel } from './Logger.js';
import { Options } from './Options.js';
import { Subcommand } from './Subcommand.js';
import { Configure } from './Configure.js';

const logger = Logger.getLogger();
 
export class ElephantBackup {

    constructor() {
        const options = Options.getInstance();
        options.configure();
        options.parse();
    }

    async start() {
        const options = Options.getInstance();
        if (options.options.verbose) {
            logger.setLogLevel(LogLevel.DEBUG);
        }
        if (options.options.develop) {
            logger.setLogLevel(LogLevel.DEVL);
        }

        // Start logging, and print the starting message.
        logger.startLog();
        logger.debug(process.argv);
    
        logger.info(`Subcommand: ${options.subcommand}`);
        logger.info(`options => `);
        logger.info(options.options);
        logger.info(`targets: ${options.targets}`);

        // Get the absolute path of Elephant Backup module. 
        let elephantPath = process.argv[1];
        const lstat = await fsPromises.lstat(elephantPath);
        if (lstat.isSymbolicLink()) {
            const link = await fsPromises.readlink(elephantPath);
            elephantPath = path.resolve(path.dirname(elephantPath), link);
        }
        elephantPath = path.resolve(elephantPath, '..', '..');
        Configure.ELEPHANT_BACKUP_PATH = elephantPath;

        console.log(Configure.ELEPHANT_BACKUP_PATH);

        const subcommand = Subcommand.create(options.subcommand);
        await subcommand.run();
    }

}
 