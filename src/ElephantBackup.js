/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
 "use strict"

import { Logger, LogLevel } from './Logger.js';
import { Options } from './Options.js';
import { Subcommand } from './Subcommand.js';

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

        const subcommand = Subcommand.create(options.subcommand);
        await subcommand.run();
    }

}
 