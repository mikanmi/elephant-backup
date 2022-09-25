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

/**
 * 
 * @param {ToDoMessage} message 
 * @param {string} zpool 
 * @param {Condition} condition
 */
async function verifyResult(message, zpool, condition) {
    const diffCommand =
            `diff -sr /${zpool} /${condition.zfsPoolArchive}/${zpool}`;

    message.add(`Confirm: the 'diff' command prints no differences.\n`);
    const diffResult = condition.spawnSync(diffCommand);
    assert.equal(diffResult.status, 0);
    message.add(diffResult.stdout.toString());
}

test('Backup one ZFS filesystem', async (t) => {
    t.diagnostic('backup single diagnostic');

    // setup
    const condition = new Condition();
    condition.prepareBackup();

    await t.test('One filesystem', async (t) => {
        const message = new ToDoMessage();

        // do the test
        const backupCommand =
                `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1}`;
        const result = condition.launch(backupCommand);
        await condition.sleep(1000);
        message.add(result.stdout.toString());

        // verify the result
        await verifyResult(message, condition.zfsPool1, condition);
        t.todo(message.toString());
    });

    // tear down
    condition.tearDown();
});

await test('Backup two ZFS filesystem', async (t) => {
    t.diagnostic(`Backup two ZFS filesystem diagnostic`);

    // setup
    const condition = new Condition();
    condition.prepareBackup();

    await t.test('First Time', async (t) => {
        const message = new ToDoMessage();

        // do the test
        const backupCommand =
                `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1} ${condition.zfsPool2}`;
        const result = condition.launch(backupCommand);
        await condition.sleep(1000);
        message.add(result.stdout.toString());

        // verify the result
        await verifyResult(message, condition.zfsPool1, condition);
        await verifyResult(message, condition.zfsPool2, condition);
        t.todo(message.toString());
    });

    await t.test('Second Time', async (t) => {
        const message = new ToDoMessage();

        // prepare the test
        condition.addFileBackup();

        // do the test
        const backupCommand =
                `${condition.settings.command} backup -a ${condition.zfsPoolArchive} ${condition.zfsPool1} ${condition.zfsPool2}`;
        const result = condition.launch(backupCommand);
        await condition.sleep(1000);
        message.add(result.stdout.toString());

        // verify result
        await verifyResult(message, condition.zfsPool1, condition);
        await verifyResult(message, condition.zfsPool2, condition);
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
