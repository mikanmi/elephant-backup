/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import test from 'node:test';
import assert from 'node:assert';

import { Condition, ToDoMessage } from './Condition.js';

test('Backup one ZFS filesystem', async (t) => {
    t.diagnostic('backup single diagnostic');

    const condition = new Condition();

    await t.test('One filesystem', async (t) => {
        const message = new ToDoMessage();

        // setup
        condition.prepareBackup();

        // do test
        const backupCommand =
                `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1}`;
        const result = condition.launch(backupCommand);
        await condition.sleep(1000);
        message.add(result.stdout.toString());

        // verify result
        message.add(`Confirm: the 'diff' command prints no differences.\n`);
        const diffCommand =
                `diff -sr /${condition.zfsPool1} /${condition.zfsPoolArchive}/${condition.zfsPool1}`;
        const diffResult = condition.spawnSync(diffCommand);
        message.add(diffResult.stdout.toString());

        t.todo(message.toString());
        assert.equal(diffResult.status, 0);
    });

    // tear down
    condition.tearDown();
});

await test('Backup two ZFS filesystem', async (t) => {
    t.diagnostic(`Backup two ZFS filesystem diagnostic`);

    const condition = new Condition();

    // setup
    condition.prepareBackup();

    await t.test('First Time', async (t) => {
        const message = new ToDoMessage();

        // do test
        const backupCommand =
                `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1} ${condition.zfsPool2}`;
        const result = condition.launch(backupCommand);
        await condition.sleep(1000);
        message.add(result.stdout.toString());

        // verify result
        message.add(`Confirm: the 'diff' command prints no differences.\n`);
        const pool1DiffCommand =
                `diff -sr /${condition.zfsPool1} /${condition.zfsPoolArchive}/${condition.zfsPool1}`;
        const p1Result = condition.spawnSync(pool1DiffCommand);
        assert.equal(p1Result.status, 0);
        message.add(p1Result.stdout.toString());

        message.add(`Confirm: the 'diff' command prints no differences.\n`);
        const pool2DiffCommand =
                `diff -sr /${condition.zfsPool2} /${condition.zfsPoolArchive}/${condition.zfsPool2}`;
        const p2Result = condition.spawnSync(pool2DiffCommand);
        assert.equal(p2Result.status, 0);
        message.add(p2Result.stdout.toString());

        t.todo(message.toString());
    });

    await t.test('Second Time', async (t) => {
        const message = new ToDoMessage();
        condition.addFileBackup();

        // do test
        const backupCommand =
                `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1} ${condition.zfsPool2}`;
        const result = condition.launch(backupCommand);
        await condition.sleep(1000);
        message.add(result.stdout.toString());

        // verify result
        message.add(`Confirm: the 'diff' command prints no differences.\n`);
        const pool1DiffCommand =
                `diff -sr /${condition.zfsPool1} /${condition.zfsPoolArchive}/${condition.zfsPool1}`;
        const p1Result = condition.spawnSync(pool1DiffCommand);
        assert.equal(p1Result.status, 0);
        message.add(p1Result.stdout.toString());

        message.add(`Confirm: the 'diff' command prints no differences.\n`);
        const pool2DiffCommand =
                `diff -sr /${condition.zfsPool2} /${condition.zfsPoolArchive}/${condition.zfsPool2}`;
        const p2Result = condition.spawnSync(pool2DiffCommand);
        assert.equal(p2Result.status, 0);
        message.add(p2Result.stdout.toString());

        t.todo(message.toString());
    });

    // tear down
    condition.tearDown();
});

// NOSONAR
// await test('print test', async (t) => {
//     t.diagnostic('print test diagnostic');
//     assert.fail();
// });
