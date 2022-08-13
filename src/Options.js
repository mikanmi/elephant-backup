/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { Command } from 'commander';

import packageJson from '../package.json' assert {type: 'json'};
import { Configure } from './Configure.js';

export class CommandType {
    static BACKUP = 'backup';
    static DIFF = 'diff';
    static SNAPSHOT = 'snapshot';
    static SYSTEMD = 'systemd';
}

export class Options {

    static #thisInstance = new Options();

    #program = new Command();

    #subCommand = this.#program;

    #targets = [''];
    #options = 
            {archive: 'unexpected', dryRun: false, verbose: false};

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
     * @returns {{archive: string, dryRun: boolean, verbose: boolean}}
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
            .requiredOption('-a, --archive <ZFS dataset>',
            'ZFS dataset to store any original ZFS pools.');
        break;
        case CommandType.DIFF:
            subcommand
            .description('Show the differences between the current of the primary filesystems and the latest backup.')
            .requiredOption('-a, --archive <ZFS dataset>',
            'ZFS dataset to store any original ZFS pools.');
            break;
        case CommandType.SNAPSHOT:
            subcommand
            .description('Take a snapshot and purge some existing snapshots on a filesystem.');
            break;
        case CommandType.SYSTEMD:
            subcommand
            .description('Enable to take a snapshot automatically or disable it.');
            break;
        }

        switch(commandType) {
        case CommandType.BACKUP:
        case CommandType.DIFF:
        case CommandType.SNAPSHOT:
            subcommand
            .argument('<ZFS pools...>',
                    'the names of one or more original ZFS pools.')
            .action((pools, _, command) => {
                this.#subCommand = command;
                this.#targets = pools;
            });
            break;   
        case CommandType.SYSTEMD:
            const enable = Configure.SYSTEMD_BEHAVIOR_ENABLE;
            const disable = Configure.SYSTEMD_BEHAVIOR_DISABLE;

            subcommand
            .argument('<behavior>',
                    `'${enable}': Install and enable auto snapshot with systemd, '${disable}': uninstall.`)
            .action((behavior, _, command) => {
                this.#subCommand = command;
                this.#targets = behavior;
            });
        }

        subcommand
        .option('-v, --verbose',
                'run with the verbose mode.',
                false)
        .option('-n, --dry-run',
                'run with no change made.',
                false);
    }
}
