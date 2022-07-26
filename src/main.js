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
import { CommandLine, CommandType } from './CommandLine.js';
import { BackupSubcommand } from './BackupSubcommand.js';
import { DiffSubcommand } from './DiffSubcommand.js';

const logger = Logger.getLogger();
const logFile = fs.createWriteStream(`${process.cwd()}/elephant-backup.log`);

// This is the entry point of this application.
entry();

export default function entry() {
    const commandLine = CommandLine.getCommandLine();
    commandLine.configure();
    commandLine.parse();

    logger.addConsole(logFile);

    if (commandLine.options.verbose) {
        logger.setLogLevel(LogLevel.DEBUG);
    }
    logger.print(`===== Start Elephant Backup =====`);
    logger.debug(process.argv);

    logger.info(`Subcommand: ${commandLine.command}`);
    logger.info(`options => `);
    logger.info(commandLine.options);
    logger.info(`targets: ${commandLine.targets}`);

    switch (commandLine.command) {
        case CommandType.BACKUP:
            const backupSubcommand = new BackupSubcommand();
            backupSubcommand.run();
            break;
        case CommandType.DIFF:
            const diffSubcommand = new DiffSubcommand();
            diffSubcommand.run();
            break;
    }

    const isRoot = isRootUser();
    if (isRoot) {
        
    }
}

/**
 * @return {boolean} true if the root user runs, otherwise false.
 */
function isRootUser() {
    // geteuid and getuid are possibly undefined
    if (!process.geteuid || !process.getuid) {
        return false;
    }

    const euid = process.geteuid();
    const uid = process.getuid();
    return euid == 0 && uid == 0;
}
