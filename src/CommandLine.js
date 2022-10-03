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
    static SNAPSHOT = 'snapshot';
    static SYSTEMD_INSTALL = 'systemd-install';
    static SYSTEMD_UNINSTALL = 'systemd-uninstall';
}

export class CommandOption {

    /**
     * Construct a Command Option instance.
     * @param {string} subcmd the sub-command of this application.
     * @param {string[]} args the arguments of this sub-command.
     * @param {any} opts the option parameters of this sub-command. 
     */
    constructor(subcmd, args, opts) {
        this.#subCommand_ = subcmd;
        this.#arguments_ = args;
        this.#archive_ = opts.archive;
        this.#dryRun_ = opts.dryRun;
        this.#verbose_ = opts.verbose;
        this.#develop_ = opts.develop;
        this.#list_ = opts.list;
        this.#progress_ = opts.progress;
    }

    /** @type {string} */
    #subCommand_;
    get subCommand() {
        return this.#subCommand_;
    }
    /** @type {string[]} */
    #arguments_;
    get arguments() {
        return this.#arguments_;
    }
    /** @type {string} */
    #archive_;
    get archive() {
        return this.#archive_;
    }
    /** @type {boolean} */
    #dryRun_;
    get dryRun() {
        return this.#dryRun_;
    }
    /** @type {boolean} */
    #verbose_;
    get verbose() {
        return this.#verbose_;
    }
    /** @type {string} */
    #develop_;
    get develop() {
        return this.#develop_;
    }
    /** @type {string} */
    #list_;
    get list() {
        return this.#list_;
    }
    /** @type {boolean} */
    #progress_;
    get progress() {
        return this.#progress_;
    }
}

export class CommandLine {
    /** @type {CommandLine} */
    static #thisInstance = new CommandLine();

    /** @type {CommandOption} */
    #option = new CommandOption('dummy sub-command', ['dummy arguments'], []);

    #program = new Command();

    #subCommand = this.#program;
    #arguments = ['unexpected arguments'];

    /**
     * Get the singleton instance.
     * @returns {CommandLine}
     */
    static getInstance() {
        return this.#thisInstance;
    }

    static getOption() {
        const instance = CommandLine.getInstance();
        return instance.#option;
    }

    /**
     * Configure the command line options.
     */
    configure() {
        this.#program
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

        const subCommand = this.#program.args[0];
        const args = this.#arguments;
        const opts = this.#subCommand.opts();

        this.#option = new CommandOption(subCommand, args, opts);
    }

    /**
     * Get the sub command.
     * @returns {string}
     */
    get subcommand() {
        return this.#program.args[0];
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
            'Specify <ZFS filesystem> to store any primary ZFS filesystems.')
            .option('-p, --progress',
                    'show the progress of backing up ZFS filesystems.',
                    false);
        break;
        case CommandType.DIFF:
            subcommand
            .description('Show the differences between the current of the primary ZFS filesystems and the latest backup.')
            .requiredOption('-a, --archive <ZFS filesystem>',
            'Specify <ZFS filesystem> to store any primary ZFS pools.');
            break;
        case CommandType.SNAPSHOT:
            subcommand
            .description('Take a snapshot and purge some existing snapshots on a ZFS filesystem.')
            .option('-l, --list',
                    'show the Elephant Backup snapshots.',
                    false);
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
        case CommandType.SNAPSHOT:
        case CommandType.BACKUP:
        case CommandType.DIFF:
        case CommandType.SYSTEMD_INSTALL:
            subcommand
            .argument('<ZFS filesystems...>',
                    'the names of one or more primary ZFS filesystems.')
            .action((pools, _, command) => {
                this.#subCommand = command;
                this.#arguments = pools;
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
                'Print verbose information running on the program.',
                false)
        .option('-n, --dry-run',
                'Run the program under no changes.',
                false)
        .option('-d, --develop',
                'Print information with the long format prefix.',
                false);
    }
}
