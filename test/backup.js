/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import test from 'node:test';
import assert from 'node:assert';

import path from 'node:path';
import child_process from 'node:child_process';

import packageJson from '../package.json' assert {type: 'json'};


class Condition {

    temporaryDirectory = './temporary'
    zfsPool1 = 'testpool1';
    zfsPool2 = 'testpool2';
    zfsPoolArchive = 'testpoolarchive';

    /**
     * Launch a command line.
     * @param {string} commandLine 
     * @returns result.
     */
    spawnSync(commandLine) {
        console.log(commandLine);

        const cmd = 'sudo';
        const tokens = commandLine.split(' ').filter(s => s != '');
        const result = child_process.spawnSync(cmd, tokens);
        if (result.error) {
            throw result.error;
        }
        if (result.stderr.length != 0) {
            console.log(result.stderr.toString().trimEnd());
        }
        if (result.stdout.length != 0) {
            console.log(result.stdout.toString().trimEnd());
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

    tearDown() {
        this.destroyPool(this.zfsPoolArchive);
        this.destroyPool(this.zfsPool2);
        this.destroyPool(this.zfsPool1);
    }
}

await test('backup single', async (t) => {
    t.diagnostic(`backup single diagnostic`);

    const condition = new Condition();

    condition.prepareBackup();

    const backupCommand =
            `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1}`;
    condition.spawnSync(backupCommand);

    const diffCommand =
            `diff -sr /${condition.zfsPool1} /${condition.zfsPoolArchive}/${condition.zfsPool1}`;
    const diffResult = condition.spawnSync(diffCommand);

    assert.equal(diffResult.status, 0);

    condition.tearDown();
});

await test('backup multiple', async (t) => {
    t.diagnostic(`backup multiple diagnostic`);

    const condition = new Condition();

    condition.prepareBackup();

    await t.test('First Time', async (t) => {
        const backupCommand =
                `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1} ${condition.zfsPool2}`;
        condition.spawnSync(backupCommand);

        const pool1DiffCommand =
                `diff -sr /${condition.zfsPool1} /${condition.zfsPoolArchive}/${condition.zfsPool1}`;
        const p1Result = condition.spawnSync(pool1DiffCommand);
        assert.equal(p1Result.status, 0);

        const pool2DiffCommand =
                `diff -sr /${condition.zfsPool2} /${condition.zfsPoolArchive}/${condition.zfsPool2}`;
        const p2Result = condition.spawnSync(pool2DiffCommand);
        assert.equal(p2Result.status, 0);
    });

    await t.test('Second Time', async (t) => {
        await new Promise(r => setTimeout(r, 1000));
        condition.addFileBackup();

        const backupCommand =
                `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1} ${condition.zfsPool2}`;
        condition.spawnSync(backupCommand);

        const pool1DiffCommand =
                `diff -sr /${condition.zfsPool1} /${condition.zfsPoolArchive}/${condition.zfsPool1}`;
        const p1Result = condition.spawnSync(pool1DiffCommand);
        assert.equal(p1Result.status, 0);

        const pool2DiffCommand =
                `diff -sr /${condition.zfsPool2} /${condition.zfsPoolArchive}/${condition.zfsPool2}`;
        const p2Result = condition.spawnSync(pool2DiffCommand);
        assert.equal(p2Result.status, 0);
    });

    condition.tearDown();

    // assert.fail('failed');
});
