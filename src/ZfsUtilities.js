/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { Command } from './Command.js'
import { CommandLine } from './CommandLine.js';
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
     * @types {string} The command line that shows ZFS filesystems *recursively* on this machine.
     */
     static CMD_ZFS_LIST_FILESYSTEM_RECURSIVE = 'zfs list -H -r -o name -t filesystem';

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
    static ZFS_SEND_RAW = 'zfs send -Rw'

    /**
     * @types {string} The command line that receives a ZFS filesystem.
     */
    static ZFS_RECV_INCREMENTAL = 'zfs recv -F -d -x mountpoint'

    /**
     * @types {string} The command line that diffs a snapshot and current on the a filesystem.
     */
    static ZFS_DIFF = 'zfs diff'

    /**
     * @types {string} Set disable auto-snapshot which you take with zfs-auto-snapshot.
     */
    static ZFS_SET_AUTO_SNAPSHOT_FALSE = 'zfs set com.sun:auto-snapshot=false'

    /**
     * @types {string} The command line that takes a snapshot with zfs-auto-snapshot.
     */
    static ZFS_TAKE_SNAPSHOT = 'zfs-auto-snapshot -qr --label=hourly'

    /**
     * @types {string} The command that show the progress of transporting backup on the standard error.
     */
    static PV = 'pv'
}

export class ZfsUtilities {
    /**
     * Disable the com.sun:auto-snapshot property on a ZFS filesystem.
     * @param {string} filesystem a ZFS filesystem.
     */
    static async disableAutoSnapshotProperty(filesystem) {
        const zfsCommand = `${ZfsCommands.ZFS_SET_AUTO_SNAPSHOT_FALSE} ${filesystem}`;
        const command = new Command(zfsCommand);
        command.printStdoutImmediately = true;
        await command.spawnIfNoDryRunAsync();
    }

    /**
     * Take a snapshot on the filesystem.
     * @param {string} filesystem a ZFS filesystem.
     * @return {Promise<string>} the new snapshot.
     */
    static async takeSnapshot(filesystem) {
        const commandLine = CommandLine.getInstance();

        const dryRun = commandLine.options.dryRun ? '-n' : '';
        const zfsCommand = `${ZfsCommands.ZFS_TAKE_SNAPSHOT} ${dryRun} ${filesystem}`;

        const command = new Command(zfsCommand);
        const stdout  = await command.spawnAsync();

        // 'stdout' includes the following:
        // zfs snapshot -o com.sun:auto-snapshot-desc='-'  'pool1@zfs-auto-snap_hourly-2021-12-11-0557'
        const element = stdout.split(`'`);
        const snapshot = element[3];

        logger.info(`Taken the new snapshot: ${snapshot}`);
        return snapshot;
    }

    /**
     * Create the ZFS dataset on the ZFS filesystem.
     * @param {string} dataset a ZFS dataset to create.
     * @param {string} filesystem a ZFS filesystem.
     */
    static async createZfsDataset(dataset, filesystem) {
        const zfsCommand = `${ZfsCommands.ZFS_CREATE_DATASET} ${filesystem}/${dataset}`;
        const command = new Command(zfsCommand);
        command.printStdoutImmediately = true;
        await command.spawnIfNoDryRunAsync();
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
        const estimateCommandLine = 
                `${ZfsCommands.ZFS_SEND_RAW} ${estimateOption} ${firstSnapshot} ${lastSnapshot}`;
        const estimateCommand = new Command(estimateCommandLine);
        estimateCommand.printStderr = 'ignore';
        const stdout = await estimateCommand.spawnIfNoDryRunAsync();

        // stdout involves the total size line like 'total estimated size is 1.22K.'
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
        const intermediate = last == '' ? '' : '-I';

        const commandLine = CommandLine.getInstance();
        const dryRun = commandLine.options.dryRun ? '-n' : '';
        const verbose = commandLine.options.verbose ? '-v' : '';

        const firstSnapshot = `${filesystem}@${first}`;
        const lastSnapshot = last == '' ? last : `${filesystem}@${last}`;

        // Spawn the backup commands set after creating and building the three below commands.
        // Building the send command of the filesystem.
        const sendCommandLine = 
                `${ZfsCommands.ZFS_SEND_RAW} ${dryRun} ${verbose} ${intermediate} ${firstSnapshot} ${lastSnapshot}`;
        const sendCommand = new Command(sendCommandLine);
        sendCommand.printStderr = 'ignore';

        // the PV command to show a progress of transportation.
        const pvCommand = new Command(ZfsCommands.PV);
        pvCommand.printStderr = 'direct';
        sendCommand.add(pvCommand);

        // Building the receive command of the snapshots.
        const receiveCommandLine =
                `${ZfsCommands.ZFS_RECV_INCREMENTAL} ${archive}`;
        const receiveCommand = new Command(receiveCommandLine);
        receiveCommand.printStdoutImmediately = true;
        pvCommand.add(receiveCommand);

        await sendCommand.spawnIfNoDryRunAsync();
    }

    /**
     * Diff the snapshot and the current on the ZFS filesystem.
     * @param {string} snapshot a snapshot on the ZFS filesystem.
     * @param {string} filesystem a ZFS filesystem.
     * @returns {Promise<string>} the message of the difference.
     */
    static async diff(snapshot, filesystem) {
        const zfsCommand = `${ZfsCommands.ZFS_DIFF} ${snapshot} ${filesystem}`
        const command = new Command(zfsCommand);
        command.printStdoutImmediately = true;
        const result = await command.spawnIfNoDryRunAsync();

        return result;
    }

    /**
     * Get all of the ZFS filesystems on this machine.
     * @returns {Promise<string[]>} all of the ZFS filesystems on this machine.
     */
    static async filesystemList() {
        const command = new Command(ZfsCommands.ZFS_LIST_FILESYSTEM);
        const result = await command.spawnAsync();

        const filesystems = result.split('\n');

        logger.debug(`ZFS filesystems: ${filesystems}`);
        return filesystems;
    }

    /**
     * Get the ZFS filesystems recursively on the ZFS filesystems.
     * @param {string} filesystem a ZFS filesystem on that this method gets recursively.
     * @returns {Promise<string[]>} the list of the ZFS filesystems recursively on the ZFS filesystems.
     */
     static async filesystemListRecursively(filesystem) {
        const command =
                new Command(`${ZfsCommands.CMD_ZFS_LIST_FILESYSTEM_RECURSIVE} ${filesystem}`);
        const result = await command.spawnAsync();

        const filesystems = result.split('\n');

        logger.debug(`ZFS filesystems: ${filesystems}`);
        return filesystems;
    }

    /**
     * Get all of the snapshots on the ZFS filesystem.
     * @param {string} filesystem a ZFS filesystem.
     * @param {string|null} snapshot a snapshot added to the snapshots for dryRun option.
     * @returns {Promise<string[]>} the snapshots on the ZFS filesystem.
     */
    static async snapshotList(filesystem, snapshot = null) {
        const zfsCommand = `${ZfsCommands.ZFS_LIST_SNAPSHOT} ${filesystem}`
        const command = new Command(zfsCommand);
        const result = await command.spawnAsync();

        const snapshots = result.split('\n');
        if (snapshot) {
            snapshots.push(snapshot);
        }

        logger.debug(`Snapshots on ${filesystem}: ${snapshots}`);
        return snapshots;
    }

    /**
     * Elephant Backup is run on the super user or not.
     * @return {boolean} true if Elephant Backup is run on the super user, otherwise false.
     */
    static isSuperUser() {
        // geteuid and getuid are possibly undefined.
        if (!process.geteuid || !process.getuid) {
            return false;
        }

        const euid = process.geteuid();
        const uid = process.getuid();
        return euid == 0 && uid == 0;
    }
}
