/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import path from 'node:path';

import { Process } from './Process.js'
import { CommandLine } from './CommandLine.js';
import { Configure } from './Configure.js';
import { Logger } from './Logger.js';

const logger = Logger.getLogger();

/**
 * OpenZFS commands
 */
class ZfsCommands {
    /**
     * @types {string} The command line that shows ZFS filesystems on this machine.
     */
    static ZFS_LIST_FILESYSTEM = 'zfs list -H -o name -t filesystem';

    /**
     * @types {string} The command line that shows ZFS filesystems on this machine.
     */
    static ZFS_LIST_SNAPSHOT = 'zfs list -H -s creation -o name -t snapshot';

    /**
     * @types {string} The command line that creates a ZFS dataset.
     */
    static ZFS_CREATE_DATASET = 'zfs create -p';

    /**
     * @types {string} The command line that sends a ZFS filesystem.
     */
    static ZFS_SEND_RAW = 'zfs send -Rw';

    /**
     * @types {string} The command line that receives a ZFS filesystem.
     */
    static ZFS_RECV_INCREMENTAL = 'zfs recv -F -d -x mountpoint';

    /**
     * @types {string} Get a value on property on a ZFS filesystem.
     */
    static ZFS_GET_PROPERTY = 'zfs get -H -o value';

    /**
     * @types {string} Take a snapshot on a ZFS filesystem.
     */
    static ZFS_TAKE_SNAPSHOT_RECURSIVE = 'zfs snapshot -r';

    /**
     * @types {string} Destroy a snapshot on a ZFS filesystem.
     */
    static ZFS_DESTROY_SNAPSHOT_RECURSIVE = 'zfs destroy -r';

    /**
     * @types {string} The command line that enable-disable the Elephant Backup systemd unit.
     */
    static ELEBA_SYSTEMD_UNIT_INSTALLER = path.join('systemd', 'installer.bash');
}

export class ZfsUtilities {

    /**
     * Take a snapshot on a ZFS filesystem.
     * @param {string} snapshot a snapshot.
     * @param {string} filesystem a ZFS filesystem.
     * @return {Promise<string>} the new snapshot long name.
     */
     static async takeSnapshot(snapshot, filesystem) {
        const snapshotLongName = `${filesystem}@${snapshot}`

        const command = `${ZfsCommands.ZFS_TAKE_SNAPSHOT_RECURSIVE} ${snapshotLongName}`;
        const process = new Process(command);
        process.syncResult();
        await process.spawnIfNoDryRunAsync();

        logger.print(`Taken the new snapshot: ${snapshotLongName}`);
        return snapshotLongName;
    }

    /**
     * Destroy a snapshot on a ZFS filesystem.
     * @param {string} snapshot a snapshot.
     * @param {string} filesystem a ZFS filesystem.
     */
     static async destroySnapshot(snapshot, filesystem) {
        const command = `${ZfsCommands.ZFS_DESTROY_SNAPSHOT_RECURSIVE} ${filesystem}@${snapshot}`;
        const process = new Process(command);
        await process.spawnIfNoDryRunAsync();

        logger.print(`Purged the snapshot: ${filesystem}@${snapshot}`);
    }

    /**
     * Create a ZFS dataset on a ZFS filesystem.
     * @param {string} dataset a ZFS dataset to be created.
     */
    static async createZfsDataset(dataset) {
        const command = `${ZfsCommands.ZFS_CREATE_DATASET} ${dataset}`;
        const process = new Process(command);
        await process.spawnIfNoDryRunAsync();
    }

    /**
     * Estimate the send size of the snapshots between first and last on the ZFS filesystem.
     * @param {string} filesystem a ZFS filesystem.
     * @param {string} first the first snapshot on the ZFS filesystem.
     * @param {string} last the last snapshot on the ZFS filesystem.
     * @return {Promise<string>} the estimate size of sending the snapshots.
     */
    static async estimateSendSize(filesystem, first, last = '') {
        const intermediate = last == '' ? '' : '-I';
        const estimateOption = `-n -v ${intermediate}`;

        const firstSnapshot = `${filesystem}@${first}`;
        const lastSnapshot = last == '' ? last : `${filesystem}@${last}`;

        // Show the estimated size of transporting the filesystem.
        const command = 
                `${ZfsCommands.ZFS_SEND_RAW} ${estimateOption} ${firstSnapshot} ${lastSnapshot}`;
        const process = new Process(command);
        process.syncResult();
        const stdout = await process.spawnIfNoDryRunAsync();

        // get the 'total size line' from stdout
        // stdout involves the 'total estimated size is 1.22K.' line.
        const words = stdout.split(' ');
        const size = words[words.length - 1];

        return size;
    }

    /**
     * Send the snapshots between first and last on the ZFS filesystem.
     * @param {string} archive a ZFS filesystem to receive the snapshots.
     * @param {string} filesystem a ZFS filesystem to send the snapshots.
     * @param {string} first the first snapshot on the ZFS filesystem.
     * @param {string} last the last snapshot on the ZFS filesystem.
     */
    static async sendAndReceiveZfsFilesystem(archive, filesystem, first, last = '') {
        const option = CommandLine.getOption();
        const intermediate = last == '' ? '' : '-I';

        const dryRun = option.dryRun ? '-n' : '';

        const enableVerbose = option.verbose || option.progress;
        const verbose = enableVerbose ? '-v' : '';

        const firstSnapshot = `${filesystem}@${first}`;
        const lastSnapshot = last == '' ? last : `${filesystem}@${last}`;

        /** @param {any} data */
        function stderrHandler(data) {
            const dataString = data.toString().trimEnd();
            // `zfs send -v` print the progress on the stderr.
            // prints the progress of `zfs send`.
            logger.prog(`${dataString}`);
        }

        // zfs send command.
        const sendCommand = 
                `${ZfsCommands.ZFS_SEND_RAW} ${dryRun} ${verbose} ${intermediate} ${firstSnapshot} ${lastSnapshot}`;
        const sendProcess = new Process(sendCommand);
        sendProcess.setStderrHandler(stderrHandler);

        // zfs recv command.
        const recvCommand =
                `${ZfsCommands.ZFS_RECV_INCREMENTAL} ${archive}`;
        const recvProcess = new Process(recvCommand);
        sendProcess.add(recvProcess);

        // run the `zfs send` and  `zfs recv` 
        await sendProcess.spawnIfNoDryRunAsync();
    }

    /**
     * Get the ZFS filesystems recursively involving itself on a ZFS filesystems.
     * @param {string} filesystem a ZFS filesystem, which is the base filesystems.
     *          If empty('') string, get all of the filesystems on this machine.
     * @returns {Promise<string[]>} the ZFS filesystems list of children on the ZFS filesystems.
     */
     static async filesystemList(filesystem='') {
        const recursiveString = filesystem === '' ? '' : '-r';
        const command = `${ZfsCommands.ZFS_LIST_FILESYSTEM} ${recursiveString} ${filesystem}`;

        const process = new Process(command);
        process.syncResult();
        const result = await process.spawnAsync();

        const filesystems = result === '' ? [] : result.split('\n');

        logger.debug(`ZFS filesystems: ${filesystems}`);
        return filesystems;
    }

    /**
     * Get all of the snapshots on a ZFS filesystem.
     * @param {string} filesystem a ZFS filesystem.
     * @param {string|null} snapshot a snapshot added to the snapshots for dryRun option.
     * @returns {Promise<string[]>} the snapshots on the ZFS filesystem.
     */
    static async snapshotList(filesystem, snapshot = null) {
        const command = `${ZfsCommands.ZFS_LIST_SNAPSHOT} ${filesystem}`
        const process = new Process(command);
        process.syncResult();
        const result = await process.spawnAsync();

        const snapshots = result === '' ? [] : result.split('\n');
        if (snapshot) {
            snapshots.push(snapshot);
            logger.debug(`Push the snapshot for DryRun option: ${snapshot}`);
        }

        logger.debug(`Snapshots on ${filesystem}: ${snapshots}`);
        return snapshots;
    }

    /**
     * Get a value of property on a ZFS filesystem recursively.
     * @param {string} filesystem a ZFS filesystem.
     * @param {string} property a property on ZFS filesystem.
     * @param {boolean} recursive true if recursive, false in default.
     * @returns {Promise<string[]>} the value.
     */
    static async getValues(filesystem, property, recursive=false) {
        const receiveOption = recursive ? '-r' : '';

        const command = `${ZfsCommands.ZFS_GET_PROPERTY} ${receiveOption} ${property} ${filesystem}`;
        const process = new Process(command);
        process.syncResult();
        const result = await process.spawnAsync();

        const values = result.trim().split('\n');
        logger.debug(`Get values: ${values}`);
        return values;
    }

    /**
     * Install and enable systemd unit.
     * @param {boolean} action install and enable if true, disable and uninstall if false.
     * @param {string[]} filesystems An array of ZFS filesystem to take snapshots automatically.
     */
     static async enableSystemd(action, filesystems) {
        const option = action ? Configure.SYSTEMD_BEHAVIOR_ENABLE : Configure.SYSTEMD_BEHAVIOR_DISABLE;

        const elephantPath = await Configure.getElephantBackupPath();
        const installerPath = path.join(elephantPath, ZfsCommands.ELEBA_SYSTEMD_UNIT_INSTALLER);

        const zfsCommand = `${installerPath} ${option} ${filesystems.join(" ")}`;
        const command = new Process(zfsCommand);
        command.printStdoutImmediately = true;
        await command.spawnIfNoDryRunAsync();
    }
}
