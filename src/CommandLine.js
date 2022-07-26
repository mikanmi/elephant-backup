/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { Command } from 'commander';

import packageJson from '../package.json' assert {type: 'json'};

export class CommandType {
    static BACKUP = 'backup';
    static DIFF = 'diff';
}

export class CommandLine {

    static #thisInstance = new CommandLine();

    #program = new Command();

    #subCommand = this.#program;

    #command = '';
    #targets = [''];
    #options = 
            {archive: 'unexpected', dryRun: false, verbose: false};

    static getCommandLine() {
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
    }

    /**
     * Parse the command line options.
     */
    parse() {
        this.#program.parse();

        this.#options = this.#subCommand.opts();
        this.#command = this.#program.args[0];
    }

    /**
     * Get the sub command.
     * @retruns {string}
     */
    get command() {
        return this.#command;
    }

    /**
     * Get the command targets.
     * @retruns {string[]}
     */
    get targets() {
        return this.#targets;
    }

    /**
     * Get the command options.
     * @retruns {{archive: string, dryRun: boolean, verbose: boolean}}
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
            .description('Back up any ZFS filesystems to another ZFS filesystems.');
            break;
        case CommandType.DIFF:
            subcommand
            .description('Show the changes of the previous backup and current primary filesystems.');
            break;
        }

        subcommand
        .argument('<ZFS pools...>',
                'the names of one or more original ZFS pools.')
        .requiredOption('-a, --archive <ZFS dataset>',
                'ZFS dataset to store any original ZFS pools.')
        .option('-v, --verbose',
                'run with the verbose mode.',
                false)
        .option('-n, --dry-run',
                'run with no change made.',
                false)
        .action((pools, _, command) => {
            this.#subCommand = command;
            this.#targets = pools;
        });
    }
}
