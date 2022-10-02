/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import test from 'node:test';
import assert from 'node:assert';

import { Condition } from './Condition.js';

/**
 * Verify the result of 'snapshot' with ZFS list command.
 * @param {string} zpool 
 * @param {string} line 
 * @param {Condition} condition
 */
async function verifyResult(zpool, line, condition) {
    const SNAPSHOT_LIST_COMMAND = 'zfs list -H -o name -t snapshot';

    const poolLineElements = line.split(' ');
    const poolSnapshot = poolLineElements[poolLineElements.length - 1];

    const listCommand =
            `${SNAPSHOT_LIST_COMMAND} ${zpool}`;
    const listResult = condition.spawnSync(listCommand);
    const snapshotListLines = listResult.stdout.toString().trim().split('\n');
    const snapshot = snapshotListLines[snapshotListLines.length - 1];

    assert.equal(poolSnapshot, snapshot);
}

await test('Snapshot one ZFS filesystem', async (t) => {
    t.diagnostic(`Snapshot one ZFS filesystem diagnostic`);

    // setup
    const condition = new Condition();
    condition.prepareBackup();

    await t.test('Snapshot one', async (t) => {
        t.diagnostic(`Snapshot one diagnostic`);

        // do test
        // take a snapshot with the 'snapshot' sub-command.
        const snapshotCommand = 
                `${condition.settings.command} snapshot ${condition.zfsPool1}`;
        const snapshotResult = condition.spawnSync(snapshotCommand);

        // verify result
        const resultLines = snapshotResult.stdout.toString().trim().split('\n');
        const resultLine = resultLines[resultLines.length - 1];
        await verifyResult(condition.zfsPool1, resultLine, condition);
    });

    // tear down
    condition.tearDown();
});

await test('Snapshot two ZFS filesystem', async (t) => {
    t.diagnostic(`Snapshot two ZFS filesystem diagnostic`);

    // setup
    const condition = new Condition();
    condition.prepareBackup();

    await t.test('Snapshot two', async (t) => {
        t.diagnostic(`Snapshot two diagnostic`);

        // do test
        // take a snapshot with the 'snapshot' sub-command.
        const snapshotCommand = 
                `${condition.settings.command} snapshot ${condition.zfsPool1} ${condition.zfsPool2}`;
        const snapshotResult = condition.spawnSync(snapshotCommand);

        // verify the result.
        const resultLines = snapshotResult.stdout.toString().trim().split('\n');
        const resultLine = resultLines[resultLines.length - 2];
        await verifyResult(condition.zfsPool1, resultLine, condition);

        const resultLine2 = resultLines[resultLines.length - 1];
        await verifyResult(condition.zfsPool2, resultLine2, condition);
    });

    // tear down
    condition.tearDown();
});

// NOSONAR
// await test('print test', async (t) => {
//     t.diagnostic('print test diagnostic');
//     assert.fail();
// });
