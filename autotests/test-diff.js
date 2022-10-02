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

await test('Diff one ZFS filesystem', async (t) => {
    t.diagnostic(`Diff one ZFS filesystem diagnostic`);

    // setup
    const condition = new Condition();
    condition.prepareBackup();

    // 1st: no difference.
    await t.test('No Difference', async (t) => {
        const message = new ToDoMessage();

        // prepare the test.
        // backup the ZFS filesystem.
        const backupCommand =
                `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1}`;
        const result = condition.spawnSync(backupCommand);
        await condition.sleep(1000);
        message.add(result.stdout.toString());

        // do the test
        // print differences with the diff sub-command.
        message.add(`Confirm: the 'diff' sub-command prints no differences.\n`);
        const sameCommand = 
                `${condition.settings.command} diff -a ${condition.zfsPoolArchive} ${condition.zfsPool1}`;
        const sameResult = condition.spawnSync(sameCommand);        
        message.add(sameResult.stdout.toString());

        // verify the result
        // expect no differences.
        assert.equal(sameResult.status, 0);

        t.todo(message.toString());
    });

    // 2nd: the one difference.
    await t.test('One Difference', async (t) => {
        const message = new ToDoMessage();

        // prepare the test.
        // add a new file on the ZFS filesystem.
        condition.addFileBackup();

        // do the test
        // print differences with the diff sub-command.
        message.add(`Confirm: the 'diff' sub-command prints one file added.\n`);
        const diffCommand = 
                `${condition.settings.command} diff -a ${condition.zfsPoolArchive} ${condition.zfsPool1}`;
        const diffResult = condition.spawnSync(diffCommand);
        message.add(diffResult.stdout.toString());

        // verify the result
        // expect one difference.
        assert.equal(diffResult.status, 0);

        t.todo(message.toString());
    });

    // tear down
    condition.tearDown();
});

await test('Diff two ZFS filesystem', async (t) => {
    t.diagnostic(`Diff two ZFS filesystem diagnostic`);

    // setup
    const condition = new Condition();
    condition.prepareBackup();

    // 1st: no difference.
    await t.test('No Difference', async (t) => {
        const message = new ToDoMessage();

        // prepare the test.
        // backup a ZFS filesystem.
        const backupCommand =
                `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1} ${condition.zfsPool2}`;
        const result = condition.spawnSync(backupCommand);
        await condition.sleep(1000);
        message.add(result.stdout.toString());

        // do the test
        // print differences with the diff sub-command.
        message.add(`Confirm: the 'diff' sub-command prints no differences.\n`);
        const sameCommand = 
                `${condition.settings.command} diff -a ${condition.zfsPoolArchive} ${condition.zfsPool1} ${condition.zfsPool2}`;
        const sameResult = condition.spawnSync(sameCommand);
        message.add(sameResult.stdout.toString());

        // verify the result
        // expect no difference.
        assert.equal(sameResult.status, 0);
        t.todo(message.toString());
    });

    // 2nd: the one difference.
    await t.test('One Difference', async (t) => {
        const message = new ToDoMessage();

        // prepare the test
        // add a new file on the ZFS filesystem.
        condition.addFileBackup();

        // do the test
        // print differences with the diff sub-command.
        message.add(`Confirm: the 'diff' sub-command prints one file added.\n`);
        const diffCommand = 
                `${condition.settings.command} diff -a ${condition.zfsPoolArchive} ${condition.zfsPool1} ${condition.zfsPool2}`;
        const diffResult = condition.spawnSync(diffCommand);
        message.add(diffResult.stdout.toString());

        // verify the result
        // expect one difference.
        assert.equal(diffResult.status, 0);
        t.todo(message.toString());
    });

    // tear down
    condition.tearDown();
});

await test('Diff not archived yet', async (t) => {
    t.diagnostic(`Diff not archived yet diagnostic`);

    // setup
    const condition = new Condition();
    condition.prepareBackup();

    await t.test('Not archived yet', async (t) => {
        const message = new ToDoMessage();

        // do the test
        // print differences with the diff sub-command.
        message.add(`Confirm: the 'diff' sub-command prints not archived yet.\n`);
        const firstCommand = 
                `${condition.settings.command} diff -a ${condition.zfsPoolArchive} ${condition.zfsPool1}`;
        const result = condition.spawnSync(firstCommand);
        await condition.sleep(1000);
        message.add(result.output.toString());

        // verify the result
        assert.ok('confirm messages:');
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
