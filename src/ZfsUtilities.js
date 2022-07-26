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
const commandArguments = CommandLine.getCommandLine();

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
    static ZFS_SEND_RAW = 'zfs send -Rw'

    /**
     * @types {string} The command line that receives a ZFS filesystem.
     */
    static ZFS_RECV_INCLIMENTAL_DEPLICATE = 'zfs recv -F -d'

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
    static disableAutoSnapshotProperty(filesystem) {
        const zfsCommand = `${ZfsCommands.ZFS_SET_AUTO_SNAPSHOT_FALSE} ${filesystem}`;
        const command = new Command(zfsCommand);
        command.spawnSyncIfNoDryRun();

        logger.debug(zfsCommand);
    }

    /**
     * Take a snapshot on the filesystem.
     * @param {string} filesystem a ZFS filesystem.
     * @return the new snapshot.
     */
    static takeSnapshot(filesystem) {
        const dryRun = commandArguments.options.dryRun ? '-n' : '';
        const zfsCommand = `${ZfsCommands.ZFS_TAKE_SNAPSHOT} ${dryRun} ${filesystem}`;

        const command = new Command(zfsCommand);
        const { stdout } = command.spawnSync();

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
    static createZfsDataset(dataset, filesystem) {
        const zfsCommand = `${ZfsCommands.ZFS_CREATE_DATASET} ${filesystem}/${dataset}`;
        const command = new Command(zfsCommand);
        command.spawnSync();
    }

    /**
     * Send the snapshots between first and last on the ZFS filesystem.
     * @param {string} archive a archive ZFS filesystem.
     * @param {string} filesystem a ZFS filesystem.
     * @param {string} first the first snapshot on the ZFS filesystem.
     * @param {string} last the last snapshot on the ZFS filesystem.
     */
    static sendAndReceiveZfsfilesystem(archive, filesystem, first, last = '') {
        const intermidiate = last == '' ? '' : '-I';
        const estimateOption = `-n -v ${intermidiate}`;

        const dryRun = commandArguments.options.dryRun ? '-n' : '';
        const verbose = commandArguments.options.verbose ? '-v' : '';

        const firstSnapshot = `${filesystem}@${first}`;
        const lastSnapshot = last == '' ? last : `${filesystem}@${last}`;

        // Show the estimated size of transporting the filesystem.
        const estimateCommandLine = 
                `${ZfsCommands.ZFS_SEND_RAW} ${estimateOption} ${firstSnapshot} ${lastSnapshot}`;
        const estimateCommand = new Command(estimateCommandLine);
        estimateCommand.spawnIfNoDryRun();

        // Spawn the backup command after creating and building a backup commands.
        // Building the send command of the filesystem.
        const sendCommandLine = 
                `${ZfsCommands.ZFS_SEND_RAW} ${dryRun} ${verbose} ${intermidiate} ${firstSnapshot} ${lastSnapshot}`;
        const sendCommand = new Command(sendCommandLine);

        // the PV command to show a progress of transportation.
        const pvCommand = new Command(ZfsCommands.PV);
        sendCommand.add(pvCommand);

        // Building the receive command of the filesystem.
        const receiveCommandLine =
                `${ZfsCommands.ZFS_RECV_INCLIMENTAL_DEPLICATE} -x mountpoint ${archive}`;
        const receiveCommand = new Command(receiveCommandLine);
        pvCommand.add(receiveCommand);

        sendCommand.spawnIfNoDryRun();
    }

    /**
     * Diff the snapshot and the current on the ZFS filesystem.
     * @param {string} snapshot a snapshot on the ZFS filesystem.
     * @param {string} filesystem a ZFS filesystem.
     */
    static diff(snapshot, filesystem) {
        const zfsCommand = `${ZfsCommands.ZFS_DIFF} ${snapshot} ${filesystem}`
        const command = new Command(zfsCommand);
        command.spawn();
    }

    /**
     * @returns {string[]} the ZFS pools on this machine.
     */
    static filesystemList() {
        const command = new Command(ZfsCommands.ZFS_LIST_FILESYSTEM);
        const returns = command.spawnSync();

        const filesystems = returns.stdout.split('\n');

        logger.debug(`ZFS filesystems: ${filesystems}`);
        return filesystems;
    }

    /**
     * @param {string} filesystem a ZFS filesystem.
     * @param {string|null} snapshot a snapshot added to the snapshots for dryRun option.
     * @returns {string[]} the snapshots on the ZFS filesystem.
     */
    static snapshotList(filesystem, snapshot = null) {
        const zfsCommand = `${ZfsCommands.ZFS_LIST_SNAPSHOT} ${filesystem}`
        const command = new Command(zfsCommand);
        const returns = command.spawnSync();

        const snapshots = returns.stdout.split('\n');
        if (snapshot) {
            snapshots.push(snapshot);
        }

        logger.debug(`Snapshots on ${filesystem}: ${snapshots}`);
        return snapshots;
    }
}
