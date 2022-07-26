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
import { Lock } from './Lock.js';

const logger = Logger.getLogger();
const commandLine = CommandLine.getCommandLine();
const lock = new Lock();

export class Command {

    /**
     * @type {string} a command with arguments.
     */
    #command;

    /**
     * @type {Command|null} a command to be piped.
     */
    #nextCommand = null;

    /**
     * Construct a Command instance with a command line.
     * @param {string} commandLine a command line.
     */
    constructor(commandLine) {
        this.#command = commandLine;
    }

    /**
     * Spawn the command line.
     * @param {stream.Readable|null} stdin the command running with the standard input.
     */
    spawn(stdin = null) {
        logger.info(`Spawn CMD: ${this.#command} / stdin: ${stdin}`);

        const tokens = this.#command.split(' ').filter(s => s != '');
        const cmd = tokens[0];
        tokens.splice(0, 1);

        const subprocess =
                child_process.spawn(cmd, tokens, { stdio: ['pipe', 'pipe', process.stderr] });
        if (stdin) {
            stdin.pipe(subprocess.stdin);
        }

        if (this.#nextCommand) {
            this.#nextCommand.spawn(subprocess.stdout);
        }
        else {
            subprocess.stdout.on('data', (data) => {
                // logger.print(data.toString('utf8'));
                logger.print(`\n${data.toString().trimEnd()}`);
            });
        }
        // subprocess.stderr.on('data', (data) => {
        //    logger.error(data.toString());
        // });
        subprocess.on('spawn', async() => {
            await lock.acquire();
            logger.info(`Spawned: ${this.#command}`);
        });
        subprocess.on('exit', (code, signal) => {
            logger.debug(`${this.#command} exit with code: ${code} / signal: ${signal}`);
            lock.release();
        });
        subprocess.on('error', (err) => {
            logger.debug(`Error Command: ${this.#command}`);
            throw err;
        });
        subprocess.on('close', (code, signal) => {
            logger.debug(`${this.#command} close with code: ${code} / signal: ${signal}`);
        });

        return;
    }

    /**
     * Spawn the command line synchronously.
     * @param {Buffer|null} input supply the command a standard input. No supply if null.
     * @returns {{stdout: string, stderr: string, status: number}}
     */
    spawnSync(input = null) {
        logger.info(`SpawnSync CMD: ${this.#command} / input: ${input}`);

        const tokens = this.#command.split(' ').filter(s => s != '');
        const cmd = tokens[0];
        tokens.splice(0, 1);

        const spawnReturns = input ?
                    child_process.spawnSync(cmd, tokens, { input: input }):
                    child_process.spawnSync(cmd, tokens);
        if (spawnReturns.error) {
            throw spawnReturns.error;
        }

        let result = {
            stdout: spawnReturns.stdout.toString().trimEnd(),
            stderr: spawnReturns.stderr.toString().trimEnd(),
            status: spawnReturns.status ?? -1,
        }

        if (this.#nextCommand) {
            result = this.#nextCommand.spawnSync(spawnReturns.stdout);
        }
        return result;
    }

    /**
     * [DryRun] Spawn the command line.
     * @param {stream.Readable|null} stdin the command running with the standard input.
     */
    #spawnDryRun(stdin = null) {
        logger.info(`spawnDryRun CMD: ${this.#command} / stdin: ${stdin}`);

        if (this.#nextCommand) {
            this.#nextCommand.#spawnDryRun(stdin);
        }
        return;
    }

    /**
     * [DryRun] Spawn the command line synchronously.
     * @param {Buffer|null} input supply the command a standard input. No supply if null.
     * @returns {{stdout: string, stderr: string, status: number}}
     */
    #spawnSyncDryRun(input = null) {
        logger.info(`spawnSyncDryRun CMD: ${this.#command} / input: ${input}`);

        let result = {
            stdout: '',
            stderr: '',
            status: 0,
        }
        if (this.#nextCommand) {
            result = this.#nextCommand.#spawnSyncDryRun();
        }
        return result;
    }

    /**
     * Spawn the command line for DryRun.
     * @param {stream.Readable|null} input supply the command a standard input. No supply if null.
     */
    spawnIfNoDryRun(input = null) {
        if (commandLine.options.dryRun) {
            this.#spawnDryRun(input);
        }
        else {
            this.spawn(input);
        }
        return;
    }

    /**
     * Spawn sync the command line for DryRun.
     * @param {Buffer|null} input supply the command a standard input. No supply if null.
     * @returns {{stdout: string, stderr: string, status: number}}
     */
    spawnSyncIfNoDryRun(input = null) {
        const result =
                commandLine.options.dryRun?
                this.#spawnSyncDryRun(input) :
                this.spawnSync(input);
        return result;
    }

    /**
     * @param {Command} command a command to be piped.
     */
    add(command) {
        this.#nextCommand = command;
    }
}
