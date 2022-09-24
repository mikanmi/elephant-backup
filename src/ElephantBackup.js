/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
 "use strict"

import { Logger, LogLevel } from './Logger.js';
import { CommandLine } from './CommandLine.js';
import { SubCommand } from './Subcommand.js';

import packageJson from '../package.json' assert {type: 'json'};

const logger = Logger.getLogger();
 
export class ElephantBackup {

    constructor() {
        const commandLine = CommandLine.getInstance();
        commandLine.configure();
        commandLine.parse();
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

        const option = CommandLine.getOption();
        if (option.verbose) {
            logger.setLogLevel(LogLevel.DEBUG);
        }
        if (option.develop) {
            logger.setLogLevel(LogLevel.DEVL);
        }

        // Start logging, and print the starting message.
        await logger.startLog();
        logger.debug(process.argv);
    
        logger.info(`Subcommand: ${option.subCommand}`);
        logger.info(`Arguments: ${option.arguments}`);
        logger.info(`Option => `);
        logger.info(option);

        const subcommand = SubCommand.create(option.subCommand);
        await subcommand.run();
    }

}
 