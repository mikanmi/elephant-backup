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

import packageJson from '../package.json' assert {type: 'json'};

const logger = Logger.getLogger();
 
export class ElephantBackup {

    constructor() {
        const options = Options.getInstance();
        options.configure();
        options.parse();
    }

    /**
     * Elephant Backup is run on the super user or not.
     * @return {boolean} true if Elephant Backup is run on the super user, otherwise false.
     */
    static isSuperUser() {
        // geteuid and getuid are possibly undefined.
        if (!process.geteuid || !process.getuid) {
            return false;
        }

        const euid = process.geteuid();
        const uid = process.getuid();
        return euid == 0 && uid == 0;
    }

    async start() {
        if (!ElephantBackup.isSuperUser()) {
            console.log(`Run the Elephant backup on the SUPER user.`);
            console.log(`e.g., sudo ${packageJson.name} --help`);
            process.exit();
        }

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
 