#!/usr/bin/env node
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
main();

export default function main() {
    const commandLine = CommandLine.getCommandLine();
    commandLine.configure();
    commandLine.parse();

    logger.addConsole(logFile);

    if (commandLine.options.verbose) {
        logger.setLogLevel(LogLevel.DEBUG);
    }
    logger.print(`===== Start Elephant Backup =====`);
    logger.debug(process.argv);

    logger.info(`Subcommand: ${commandLine.subcommand}`);
    logger.info(`options => `);
    logger.info(commandLine.options);
    logger.info(`targets: ${commandLine.targets}`);

    switch (commandLine.subcommand) {
        case CommandType.BACKUP:
            const backupSubcommand = new BackupSubcommand();
            backupSubcommand.run();
            break;
        case CommandType.DIFF:
            const diffSubcommand = new DiffSubcommand();
            diffSubcommand.run();
            break;
    }
}
