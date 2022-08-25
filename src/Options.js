/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { Command, Option } from 'commander';

import packageJson from '../package.json' assert {type: 'json'};

export class CommandType {
    static BACKUP = 'backup';
    static DIFF = 'diff';
    static SNAPSHOT = 'snapshot';
    static SYSTEMD_INSTALL = 'systemd-install';
    static SYSTEMD_UNINSTALL = 'systemd-uninstall';
}

/**
 * A number, or a string containing a number.
 * @typedef {{archive: 'unexpected', dryRun: false, verbose: false, develop: false, list: false}} OptionList
 */

export class Options {

    static #thisInstance = new Options();

    #program = new Command();

    #subCommand = this.#program;

    #targets = [''];
    /** @type {OptionList} */
    #options = 
            {archive: 'unexpected', dryRun: false, verbose: false, develop: false, list: false};

    static getInstance() {
        return this.#thisInstance;
    }

    /**
     * Configure the command line options.
     */
    configure() {
        const program = this.#program

        program
            .name(packageJson.name)
            .description('Elephant Backup is a backup/archive program that raw-copies your ZFS filesystems to another.')
            .version(packageJson.version);

        this.#configureCommand(CommandType.BACKUP);
        this.#configureCommand(CommandType.DIFF);
        this.#configureCommand(CommandType.SNAPSHOT);
        this.#configureCommand(CommandType.SYSTEMD_INSTALL);
        this.#configureCommand(CommandType.SYSTEMD_UNINSTALL);
    }

    /**
     * Parse the command line options.
     */
    parse() {
        this.#program.parse();

        this.#options = this.#subCommand.opts();
    }

    /**
     * Get the sub command.
     * @returns {string}
     */
    get subcommand() {
        return this.#program.args[0];
    }

    /**
     * Get the command targets.
     * @returns {string[]}
     */
    get targets() {
        return this.#targets;
    }

    /**
     * Get the command options.
     * @returns {OptionList}
     */
    get options() {
        return this.#options;
    }


    /**
     * @param {string} commandType
     */
    #configureCommand(commandType) {
        const program = this.#program;
        const subcommand = program.command(commandType);

        switch(commandType) {
        case CommandType.BACKUP:
            subcommand
            .description('Back up any ZFS filesystems to another ZFS filesystems.')
            .requiredOption('-a, --archive <ZFS filesystem>',
            'Specify <ZFS filesystem> to store any primary ZFS filesystems.');
        break;
        case CommandType.DIFF:
            subcommand
            .description('Show the differences between the current of the primary ZFS filesystems and the latest backup.')
            .requiredOption('-a, --archive <ZFS filesystem>',
            'Specify <ZFS filesystem> to store any primary ZFS pools.');
            break;
        case CommandType.SNAPSHOT:
            subcommand
            .description('Take a snapshot and purge some existing snapshots on a ZFS filesystem.');
            break;
        case CommandType.SYSTEMD_INSTALL:
            subcommand
            .description('Enable to automatically take snapshots.');
            break;
        case CommandType.SYSTEMD_UNINSTALL:
            subcommand
            .description('Disable to automatically take snapshots.');
            break;
        }

        switch(commandType) {
        // @ts-ignore
        case CommandType.SNAPSHOT:
            subcommand
            .option('-l, --list',
                    'show the Elephant Backup snapshots.',
                    false);
            // Fallthrough
        case CommandType.BACKUP:
        case CommandType.DIFF:
        case CommandType.SYSTEMD_INSTALL:
            subcommand
            .argument('<ZFS filesystems...>',
                    'the names of one or more primary ZFS filesystems.')
            .action((pools, _, command) => {
                this.#subCommand = command;
                this.#targets = pools;
            });
            break;
        case CommandType.SYSTEMD_UNINSTALL:
            subcommand
            .action((_, command) => {
                this.#subCommand = command;
            });
            break;
        }

        subcommand
        .option('-v, --verbose',
                'run with the verbose mode.',
                false)
        .option('-n, --dry-run',
                'run with no change made.',
                false)
        .addOption(new Option(
                '-d, --develop',
                'run with the develop mode.')
                .default(false)
                .conflicts('verbose'));
    }
}
