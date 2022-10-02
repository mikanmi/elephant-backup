/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import path from 'node:path';
import child_process from 'node:child_process';

import packageJson from '../package.json' assert {type: 'json'};

export class Condition {

    #verbose = false;

    temporaryDirectory = './temporary'
    zfsPool1 = 'testpool1';
    zfsPool2 = 'testpool2';
    zfsPoolArchive = 'testpoolarchive';

    /**
     * Launch a command line.
     * @param {string} commandLine 
     * @returns result
     */
    launch(commandLine) {
        const result = this.spawnSync(commandLine);
        return result;
    }

    /**
     * Spawn a command line.
     * @param {string} commandLine 
     * @returns result.
     */
    spawnSync(commandLine, print=this.#verbose) {
        if (print) {
            console.log(commandLine);
        }
        const cmd = 'sudo';
        const tokens = commandLine.split(' ').filter(s => s != '');
        const result = child_process.spawnSync(cmd, tokens);
        if (result.error) {
            throw result.error;
        }
        if (print) {
            if (result.stderr.length != 0) {
                console.log(result.stderr.toString().trimEnd());
            }
            if (result.stdout.length != 0) {
                console.log(result.stdout.toString().trimEnd());
            }
        }

        return result;
    }

    /**
     * Get command
     * @returns the path of the main file.
     */
    get settings() {
        const cmd = 'pwd';
        const result = this.spawnSync(cmd);

        const current = result.stdout.toString().trim();
        const main = path.join(current, packageJson.main);
        const command = `node ${main}`;

        const settings = { command, current };
        return settings;
    }

    /**
     * Create a ZFS pool.
     * @param {string} name
     */
    createPool(name) {
        const filePath = path.join(this.temporaryDirectory, name);
        const absoluteFilePath = path.resolve(this.settings.current, filePath);

        const createFileCommand =  `fallocate -l 64M ${absoluteFilePath}`;
        this.spawnSync(createFileCommand);

        const createPoolCommand = `zpool create ${name} ${absoluteFilePath}`;
        this.spawnSync(createPoolCommand);
    }

    /**
     * Destroy the ZFS pool.
     * @param {string} name
     */
    destroyPool(name) {
        const destroyCommand =  `zpool destroy ${name}`;
        this.spawnSync(destroyCommand);
    }

    /**
     * Create a file on the directory.
     * @param {string} name 
     * @param {number} size 
     * @param {string} directory 
     */
    createFile(name, size, directory) {
        const filePath = path.join(directory, name);

        const blockSize = Math.floor(size / 1024);
        let command;
        if (blockSize == 0) {
            command = `dd bs=1 count=${size} if=/dev/urandom of=${filePath}`;
        }
        else {
            command = `dd bs=1024 count=${blockSize} if=/dev/urandom of=${filePath}`;
        }
        this.spawnSync(command);
    }

    prepareBackup() {
        // Make the temporary directory.
        const absoluteFilePath = path.resolve(this.settings.current, this.temporaryDirectory);

        const makeCommand =  `mkdir -p ${absoluteFilePath}`;
        this.spawnSync(makeCommand);

        // Create ZFS pools
        this.createPool(this.zfsPool1);
        this.createPool(this.zfsPool2);
        this.createPool(this.zfsPoolArchive);

        // Create test files.
        const file1Byte = 'file1Byte';
        this.createFile(file1Byte, 1, `/${this.zfsPool1}`);

        const file100MByte = 'file1MByte';
        this.createFile(file100MByte, 1024 * 1024, `/${this.zfsPool1}`);

        const file0Byte = 'file0Byte';
        this.createFile(file0Byte, 0, `/${this.zfsPool2}`);

    }

    addFileBackup() {
        const file2Byte = 'file2Byte';
        this.createFile(file2Byte, 2, `/${this.zfsPool1}`);
    }

    /**
     * sleep for some milliseconds
     * @param {number} ms milliseconds
     */
    async sleep(ms) {
        await new Promise(r => setTimeout(r, ms));
    }

    tearDown() {
        this.destroyPool(this.zfsPoolArchive);
        this.destroyPool(this.zfsPool2);
        this.destroyPool(this.zfsPool1);
    }
}

export class ToDoMessage {
    #message = '\n';

    /**
     * @param {string} message 
     */
    add(message) {
        this.#message += message + '\n';
    }

    /**
     * @returns {string} message
     */
    toString() {
        return this.#message;
    }
}
