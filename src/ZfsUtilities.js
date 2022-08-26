/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import path from 'node:path';

import { Command } from './Command.js'
import { Options } from './Options.js';
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
     * @types {string} The command line that diffs a snapshot and current on the a filesystem.
     */
    static ZFS_SNAPSHOT_RECURSIVE = 'zfs snapshot -r'

    /**
     * @types {string} The command line that diffs a snapshot and current on the a filesystem.
     */
    static ZFS_DESTROY_RECURSIVE = 'zfs destroy -r'

    /**
     * @types {string} The command line that enable-disable the Elephant Backup systemd unit.
     */
    static ELEBA_SYSTEMD_UNIT_INSTALLER = path.join('systemd', 'installer.bash');
}

export class ZfsUtilities {

    /**
     * @type {string} The time used in taking a snapshot.
     */
    static #now = ZfsUtilities.#getNowDate();

    static #getNowDate() {
        // Get the current time in ISO format.
        const date = new Date();

        const fy = date.getFullYear().toString().padStart(4, '0');
        const mo = date.getMonth().toString().padStart(2,'0');
        const d = date.getDate().toString().padStart(2,'0');
        const h = date.getHours().toString().padStart(2,'0');
        const mi = date.getMinutes().toString().padStart(2,'0');
        const s = date.getSeconds().toString().padStart(2,'0');

        const localDate = `${fy}-${mo}-${d}-${h}${mi}${s}`;
        return localDate;
    }

    /**
     * Parse a date string.
     * @param {string} date a date string used on snapshot.
     * @returns {Date} a Date instance made from the date string.
     */
     static parseDate(date) {
        const dateElements = date.split('-');
        const dateTime = dateElements.pop() ?? 'unexpected time';
        for (let index = 0; index < 6; index+=2) {
            dateElements.push(dateTime.slice(index, index + 2));
        }

        const dateNumbers = dateElements.map(e => Number(e));
        const dateInstance = new Date(Date.UTC(dateNumbers[0], dateNumbers[1], dateNumbers[2],
                dateNumbers[3], dateNumbers[4], dateNumbers[5]));
        // UTC to Local Time
        dateInstance.setMinutes(dateInstance.getMinutes() + dateInstance.getTimezoneOffset());

        return dateInstance;
    }

    /**
     * Take a snapshot on the ZFS filesystem.
     * @param {string} filesystem a ZFS filesystem.
     * @return {Promise<string>} the new snapshot.
     */
     static async takeSnapshot(filesystem) {
        const snapshotTag = `${Configure.PREFIX_SNAPSHOT}-${ZfsUtilities.#now}`;

        const snapshotName = `${filesystem}@${snapshotTag}`

        const zfsCommand = `${ZfsCommands.ZFS_SNAPSHOT_RECURSIVE} ${snapshotName}`;
        const command = new Command(zfsCommand);
        await command.spawnIfNoDryRunAsync();

        logger.print(`Taken the new snapshot: ${snapshotName}`);
        return snapshotName;
    }

    /**
     * Destroy a snapshot on the ZFS filesystem.
     * @param {string} snapshot a snapshot.
     * @param {string} filesystem a ZFS filesystem.
     */
     static async destroySnapshot(snapshot, filesystem) {
        const zfsCommand = `${ZfsCommands.ZFS_DESTROY_RECURSIVE} ${filesystem}@${snapshot}`;
        const command = new Command(zfsCommand);
        await command.spawnIfNoDryRunAsync();

        logger.print(`Purged the snapshot: ${filesystem}@${snapshot}`);
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
        estimateCommand.setStdErrHandler(null);
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

        const commandLine = Options.getInstance();
        const dryRun = commandLine.options.dryRun ? '-n' : '';
        const verbose = commandLine.options.verbose ? '-v' : '';

        const firstSnapshot = `${filesystem}@${first}`;
        const lastSnapshot = last == '' ? last : `${filesystem}@${last}`;

        // Spawn the backup commands set after creating and building the three below commands.
        // Building the send command of the filesystem.
        const stderrHandler = (/** @type {any} */ data) => {
            const dataString = data.toString().trimEnd();
            // print the child's stderr immediately on the application stdout.
            logger.print(`${dataString}`);
        };

        const sendCommandLine = 
                `${ZfsCommands.ZFS_SEND_RAW} ${dryRun} ${verbose} ${intermediate} ${firstSnapshot} ${lastSnapshot}`;
        const sendCommand = new Command(sendCommandLine);
        sendCommand.setStdErrHandler(stderrHandler);

        // Building the receive command of the snapshots.
        const receiveCommandLine =
                `${ZfsCommands.ZFS_RECV_INCREMENTAL} ${archive}`;
        const receiveCommand = new Command(receiveCommandLine);
        receiveCommand.printStdoutImmediately = true;
        sendCommand.add(receiveCommand);

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
     * Get the child ZFS filesystems recursively on a ZFS filesystems.
     * @param {string} filesystem a ZFS filesystem that has children. If the empty string(''), return root ZFS filesystems.
     * @param {boolean} recursive true if get the children recursively, false if get only the children.
     * @returns {Promise<string[]>} the list of the ZFS filesystems recursively on the ZFS filesystems.
     */
     static async filesystemList(filesystem='', recursive=false) {
        const recursiveOption = recursive ? '-r' : '';
        const command =
                new Command(`${ZfsCommands.ZFS_LIST_FILESYSTEM} ${recursiveOption} ${filesystem}`);
        const result = await command.spawnAsync();

        const filesystems = result === '' ? [] : result.split('\n');

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

        const snapshots = result === '' ? [] : result.split('\n');
        if (snapshot) {
            snapshots.push(snapshot);
            logger.debug(`Push the snapshot for DryRun option: ${snapshot}`);
        }

        logger.debug(`Snapshots on ${filesystem}: ${snapshots}`);
        return snapshots;
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
        const command = new Command(zfsCommand);
        command.printStdoutImmediately = true;
        await command.spawnIfNoDryRunAsync();
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
