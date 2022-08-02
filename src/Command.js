/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import child_process from 'node:child_process';
import stream from 'node:stream';
import { Logger } from './Logger.js';
import { CommandLine } from './CommandLine.js';

const logger = Logger.getLogger();


export class Command {
    /**
     * @type {string} a command with arguments.
     */
    #commandWithArguments;

    /**
     * @type {Command|null} a command to be piped.
     */
    #nextCommand = null;

    /**
     * Print the standard error on the standard error of the application.
     * @type {boolean}
     */
    printStderrDirect = false;

    /**
     * Print the standard out immediately.
     * @type {boolean}
     */
    printStdoutImmediately = false;

    /**
     * Construct a Command instance with a command line.
     * @param {string} commandWithArgs a command line.
     */
    constructor(commandWithArgs) {
        this.#commandWithArguments = commandWithArgs;
    }

    /**
     * Spawn the command line if not DryRun.
     * @param {stream.Readable|null} stdin supply the command a standard input. No supply if null.
     * @return {Promise<string>} The result of spawn the command line.
     */
     async spawnIfNoDryRunAsync(stdin = null) {
        const commandLine = CommandLine.getInstance();

        const result = commandLine.options.dryRun ?
             await this.#spawnDryRunAsync(stdin) :
             await this.spawnAsync(stdin);
        return result;
    }

    /**
     * Spawn the command line.
     * @param {stream.Readable|null} stdin the command running with the standard input.
     * @return {Promise<string>} The result of spawn the command line.
     */
     async spawnAsync(stdin = null) {
        logger.info(`Spawn CMD: ${this.#commandWithArguments} / stdin: ${stdin}`);

        const tokens = this.#commandWithArguments.split(' ').filter(s => s != '');
        const cmd = tokens[0];
        tokens.splice(0, 1);

        const child = this.printStderrDirect ?
                child_process.spawn(cmd, tokens, {stdio: ['pipe', 'pipe', process.stderr]}) :
                child_process.spawn(cmd, tokens, {stdio: ['pipe', 'pipe', 'pipe']});

        const promises = [];

        // relay the stdin variable to the child's stdin.
        stdin?.pipe(child.stdin);

        // bind the child's stdout and the next command's stdin. 
        if (this.#nextCommand) {
            const nextPromise = this.#nextCommand.spawnAsync(child.stdout);
            promises.push(nextPromise);
        }

        // prepare handlers of the command event.
        const promise = this.#createPromise(child);
        promises.push(promise);

        const stdout = await Promise.all(promises);

        return stdout[0];
    }

    /**
     * @param {child_process.ChildProcess} child
     * @return {Promise<string>}
     */
    #createPromise(child) {
        let stdout = '';

        const promise = new Promise((resolve, _) => {
            child.stdout?.on('data', (data) => {
                const dataString = data.toString().trimEnd();
                stdout += dataString;
                if (this.printStdoutImmediately) {
                    // print the child's stdout immediately on the application stdout.
                    logger.print(`\n${dataString}`);
                }
            });
            // stderr is undefined if printStderrDirect is true.
            child.stderr?.on('data', (data) => {
                const dataString = data.toString().trimEnd();
                // print the child's stderr immediately on the application stdout.
                logger.error(`${dataString}`);
            });

            child.on('spawn', () => {
                logger.info(`Spawned: ${this.#commandWithArguments}`);
            });
            child.on('exit', (code, signal) => {
                logger.debug(`${this.#commandWithArguments} exit with code: ${code} / signal: ${signal}`);
            });    
            child.on('error', (err) => {
                logger.debug(`Error Command: ${this.#commandWithArguments}`);
                throw err;
            });
            child.on('close', (code, signal) => {
                logger.debug(`${this.#commandWithArguments} close with code: ${code} / signal: ${signal}`);
                resolve(stdout);
            });
        });
        return promise;
    }
    
    /**
     * [DryRun] Spawn the command line the same interface as spawnAsync.
     * @param {stream.Readable|null} stdin the command running with the standard input.
     * @return {Promise<string>} The result of spawn the command line.
     */
     async #spawnDryRunAsync(stdin = null) {
        logger.info(`spawnDryRunAsync CMD: ${this.#commandWithArguments} / stdin: ${stdin}`);

        let result = '';
        if (this.#nextCommand) {
            result = await this.#nextCommand.#spawnDryRunAsync(stdin);
        }
        return result;
    }

    /**
     * Add a command to this instance.
     * @param {Command} command a command to be piped.
     */
    add(command) {
        this.#nextCommand = command;
    }
}
