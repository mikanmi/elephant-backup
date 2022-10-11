/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import child_process from 'node:child_process';
import stream from 'node:stream'; // NOSONAR
import { Logger } from './Logger.js';
import { CommandLine } from './CommandLine.js';

const logger = Logger.getLogger();


export class Process {
    /**
     * @type {string} a command with arguments.
     */
    #commandWithArguments;

    /**
     * @type {Process|null} a piped process.
     */
    #pipedProcess = null;

    /**
     * @type {((data: any) => void)}
     */
    #stderrHandler;

    /**
     * @type {((data: any) => void)}
     */
    #stdoutHandler;

    /**
     * Get the stdout as the return value.
     * @type {boolean}
     */
    #syncResult = false;

    /**
     * Print the standard out immediately.
     * @type {boolean}
     */
    printStdoutImmediately = false;

    /**
     * Construct a Process instance with a command line.
     * @param {string} commandWithArgs a command line.
     */
    constructor(commandWithArgs) {
        this.#commandWithArguments = commandWithArgs;

        /**
         * the default standard error handler.
         * the handler print a error message with logger.
         * @param {any} data
         */
        function defaultStdoutHandler(data) {
            const dataString = data.toString().trimEnd();
            logger.print(`\n${dataString}`);
        };
        this.#stdoutHandler = defaultStdoutHandler;

        /**
         * the default standard error handler.
         * the handler print a error message with logger.
         * @param {any} data
         */
        function defaultStderrHandler(data) {
            const dataString = data.toString().trimEnd();
            logger.error(`${dataString}`);
        };
        this.#stderrHandler = defaultStderrHandler;
    }

    /**
     * Spawn the process with the standard input. If the DryRun option is enable, print the process.
     * @param {stream.Readable|null} stdin the standard input of the process. No supply if null.
     * @return {Promise<string>} The result of spawn the command line.
     */
     async spawnIfNoDryRunAsync(stdin = null) {
        const option = CommandLine.getOption();

        const result = option.dryRun ?
             await this.#spawnDryRunAsync(stdin) :
             await this.spawnAsync(stdin);
        return result;
    }

    /**
     * Spawn the process with the standard input.
     * @param {stream.Readable|null} stdin the standard input of the process. No supply if null.
     * @return {Promise<string>} The result of spawn the command line.
     */
     async spawnAsync(stdin = null) {
        logger.info(`Spawn CMD: ${this.#commandWithArguments} / stdin: ${stdin}`);

        const tokens = this.#commandWithArguments.split(' ').filter(s => s != '');
        const cmd = tokens[0];
        tokens.splice(0, 1);

        const child = 
                child_process.spawn(cmd, tokens, {stdio: ['pipe', 'pipe', 'pipe']});
        const promises = [];

        // relay the stdin variable to the child's stdin.
        stdin?.pipe(child.stdin);

        // bind the child's stdout and the next command's stdin. 
        if (this.#pipedProcess) {
            const nextPromise = this.#pipedProcess.spawnAsync(child.stdout);
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
            // skip this stdout handler if piped stdout to the child's stdin
            if (!this.#pipedProcess) {
                child.stdout?.on('data', (data) => {
                    if (this.#syncResult) {
                        const dataString = data.toString().trimEnd();
                        stdout += dataString;
                    }
                    else {
                        this.#stdoutHandler.call(this, data);
                    }
                });
            }
            child.stderr?.on('data', (data) => {
                this.#stderrHandler.call(this, data);
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
                if (code != 0 ||
                        signal) {
                    logger.error(`${this.#commandWithArguments} close error with code: ${code} / signal: ${signal}`);
                    throw new Error(`CMD: "${this.#commandWithArguments}" with code: ${code} / signal: ${signal}`);
                }
                resolve(stdout);
            });
        });
        return promise;
    }
    
    /**
     * [DryRun] Spawn the process as same as the spawnAsync interface.
     * @param {stream.Readable|null} stdin the standard input of the process. No supply if null.
     * @return {Promise<string>} The result of spawn the command line.
     */
     async #spawnDryRunAsync(stdin = null) {
        logger.info(`spawnDryRunAsync CMD: ${this.#commandWithArguments} / stdin: ${stdin}`);

        let result = '';
        if (this.#pipedProcess) {
            result = await this.#pipedProcess.#spawnDryRunAsync(stdin);
        }
        return result;
    }

    /**
     * Add a process to this instance.
     * @param {Process|null} process a process to be piped. if null, bind the stdout to the null device.
     */
    add(process) {
        this.#pipedProcess = process;
    }

    /**
     * Set a standard error handler to this instance.
     * @param {((data: any) => void)} handler a standard error handler, which handles the standard error message.
     */
     setStderrHandler(handler) {
        this.#stderrHandler = handler;
    }

    /**
     * Set a standard out handler to this instance.
     * @param {((data: any) => void)} handler a standard out handler, which handles the standard out message.
     */
     setStdoutHandler(handler) {
        this.#stdoutHandler = handler;
    }

    /**
     * Change the standout behavior to get the standout as the return value.
     */
     syncResult() {
        this.#syncResult = true;
    }
}
