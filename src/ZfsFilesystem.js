/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { Configure } from "./Configure.js";
import { Logger } from "./Logger.js";
import { ZfsUtilities } from "./ZfsUtilities.js";

const logger = Logger.getLogger();

export class SnapshotList {

    #filesystem = 'Unexpected filesystem';
    #snapshots = ['Unexpected snapshot'];

    /**
     * Construct a Snapshot instance with the list of snapshots.
     * @param {string[]} snapshots a list of snapshots.
     */
    constructor(snapshots) {

        if (snapshots.length == 0) {
            this.#filesystem = '';
            this.#snapshots = [];
        }
        else {
            this.#filesystem = snapshots[0].split('@')[0];
            this.#snapshots = snapshots.map(s => s.split('@')[1]);
        }
        logger.debug(`Construct SnapshotList instance.`);
        logger.debug(`ZFS filesystem: ${this.#filesystem}`);
        logger.debug(`ZFS snapshot list as the following:`);
        logger.debug(this.#snapshots);
    }

    /**
     * Find the snapshot that common and earliest.
     * @param {SnapshotList} snapshots A list of snapshots.
     * @returns  {string|null} the snapshot if found, otherwise null.
     */
    findLatest(snapshots) {
        const filter = snapshots.#snapshots;
        const common = this.#snapshots.filter(s => filter.includes(s));

        const result = common.length > 0 ? common[common.length - 1] : null;

        logger.debug(`The latest of the common snapshots: ${result}`);
        return result;
    }

    /**
     * Get the earliest snapshot.
     * @returns  {string|null} the latest snapshot if exist, otherwise null.
     */
     getEarliest() {
        const result = this.#snapshots.length > 0 ? this.#snapshots[0] : null;
        return result;
     }

    /**
     * Get the latest snapshot.
     * @returns {string|null} the latest snapshot if exist, otherwise null.
     */
     getLatest() {
        const snapshots = this.#snapshots;
        const length = snapshots.length;

        const result = length > 0 ? snapshots[length - 1] : null;

        logger.debug(result);
        return result;
     }

    /**
     * Get the array of snapshots on this instance.
     * @returns {string[]} the array of snapshots.
     */
    getSnapshots() {
        return this.#snapshots;
    }

}

export class ZfsFilesystem {

    #name = 'Unexpected filesystem';

    /** @type {string|null} */
    #newSnapshot = null;

    /**
     * Construct a ZfsFilesystem with the filesystem variable.
     * @param {string} filesystem a ZFS filesystem.
     */
    constructor(filesystem) {
        this.#name = filesystem;
    }

    /**
     * Create a ZFS Dataset on the filesystem.
     * @param {string} dataset the name of a ZFS dataset to create.
     * @returns the created ZFS dataset.
     */
    async create(dataset) {
        await ZfsUtilities.createZfsDataset(dataset, this.#name);
        return new ZfsFilesystem(`${this.#name}/${dataset}`);
    }

    /**
     * Open the ZFS dataset on the filesystem.
     * @param {string} dataset the name of a ZFS dataset to open.
     * @returns {ZfsFilesystem} a ZfsFilesystem instance associated with the dataset.
     */
     open(dataset) {
        return new ZfsFilesystem(`${this.#name}/${dataset}`);
    }

    /**
     * Open all of the ZFS datasets contained in the filesystem.
     * @returns {Promise<ZfsFilesystem[]>} a ZfsFilesystem array of all the ZFS datasets contained in the filesystem.
     */
     async openRecursively() {
        const filesystems = await ZfsUtilities.filesystemListRecursively(this.#name);
        const zfsFilesystems = 
                filesystems.map((filesystem) => new ZfsFilesystem(filesystem));
        return zfsFilesystems;
    }

    /**
     * Estimate the send size of the snapshots between first and last on the ZFS filesystem.
     * @param {string} first the first snapshot.
     * @param {string} last the last snapshot. send the only one snapshot if last is empty string.
     * @return {Promise<string>} the estimated size.
     */
    async estimateBackupSize(first, last = '') {
        const result = await ZfsUtilities.estimateSendSize(this.#name, first, last);
        return result;
    }

    /**
     * Back up the snapshots between first and last on the filesystem.
     * @param {string} archive a ZFS filesystem to store the filesystem.
     * @param {string} first the first snapshot.
     * @param {string} last the last snapshot. send only one snapshot if last is empty string.
     */
    async backup(archive, first, last = '') {
        await ZfsUtilities.sendAndReceiveZfsFilesystem(archive, this.#name, first, last);
    }

    /**
     * Take the new snapshot on the ZFS filesystem.
     */
    async takeNewSnapshot() {
        // take the new snapshot and get the snapshot list on the filesystem.
        const snapshot = await ZfsUtilities.takeSnapshot(this.#name);
        this.#newSnapshot = snapshot;
    }

    /**
     * Purge snapshots on the ZFS filesystem.
     */
     async purgeSnapshots() {
        const now = new Date();

        const list = await this.getSnapshots();
        const snapshots = list.getSnapshots();
        {
            // purge some snapshots of the keeping week area.
            const baseTime = new Date(now);
            const breakTime = new Date(now);
            // the base time is (Configure.SNAPSHOT_KEEP_WEEKS * 7) days.
            baseTime.setDate(baseTime.getDate() - Configure.SNAPSHOT_KEEP_WEEKS * 7);
            // the break time is the border of the keeping days time.
            breakTime.setDate(breakTime.getDate() - Configure.SNAPSHOT_KEEP_DAYS);
            await this.#destroySnapshot(snapshots, baseTime, breakTime, 7)
        }
        {
            // purge some snapshots of the keeping day area.
            const baseTime = new Date(now);
            const breakTime = new Date(now);
            // the base time is Configure.SNAPSHOT_KEEP_DAYS days.
            baseTime.setDate(baseTime.getDate() - Configure.SNAPSHOT_KEEP_DAYS);
            // the break time is the border of the keeping hours time.
            breakTime.setDate(breakTime.getDate() - Configure.SNAPSHOT_KEEP_HOURS / 24);
            await this.#destroySnapshot(snapshots, baseTime, breakTime, 1)
        }
    }

    /**
     * Destroy a snapshot on the ZFS filesystem.
     * @param {string[]} snapshots a array of snapshots.
     * @param {Date} baseTime the base date.
     * @param {Date} breakTime the break date.
     * @param {number} offset a date offset to decrease the base date.
     */
    async #destroySnapshot(snapshots, baseTime, breakTime, offset) {
        for (const snapshot of snapshots) {
            const dateString = snapshot.slice(Configure.PREFIX_SNAPSHOT.length + 1);
            const snapshotTime = ZfsUtilities.parseDate(dateString);
            if (snapshotTime > baseTime) {
                await ZfsUtilities.destroySnapshot(snapshot, this.#name);
                continue;
            }
            baseTime = snapshotTime;
            baseTime.setDate(baseTime.getDate()- offset);
            if (breakTime > baseTime) {
                break;
            }
        }
    }

    /**
     * Get the snapshot list.
     * @return {Promise<SnapshotList>} the list of the snapshots on this filesystem.
     */
     async getSnapshots() {
        const snapshots = await ZfsUtilities.snapshotList(this.#name, this.#newSnapshot);
        const list = new SnapshotList(snapshots);

        return list;
     }

    /**
     * Diff a snapshot and the current.
     * @param {string} snapshot a snapshot on the ZFS filesystem.
     * @returns {Promise<string>} a message of the difference.
     */
     async diff(snapshot) {
        const message = await ZfsUtilities.diff(`${this.#name}@${snapshot}`, this.#name);
        return message;
     }

    get name () {
        return this.#name;
    }
}