/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { Configure } from "./Configure.js";
import { Logger } from "./Logger.js";
import { Options } from "./Options.js";
import { Snapshot } from "./Snapshot.js";
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
     * Get snapshots by the young, the middle, and the old generations.
     * @returns {Promise<{youngSnapshots: string[], middleSnapshots: string[], oldSnapshots: string[]}>}
     *     an object of snapshots by the young, the middle, and the old generations.
     */
    async getSnapshotsByGenerations() {
        const now = new Date();

        const snapshots = this.#snapshots;

        // the young generation is between now to Configure.SNAPSHOT_KEEP_HOURS
        const hourLimit = new Date(now);
        hourLimit.setHours(hourLimit.getHours() - Configure.SNAPSHOT_KEEP_HOURS);

        // the middle generation is between 'hourLimit'(hours) to Configure.SNAPSHOT_KEEP_DAYS * 24(hours).
        const dayLimit = new Date(now);
        dayLimit.setDate(dayLimit.getDate() - Configure.SNAPSHOT_KEEP_DAYS);

        // the old generation is between Configure.SNAPSHOT_KEEP_DAYS to the infinite time.
        // const weekLimit = new Date(now);
        // weekLimit.setDate(hourLimit.getDate() - Configure.SNAPSHOT_KEEP_WEEKS * 7);

        /** @type {string[]} */ 
        const youngSnapshots = [];
        /** @type {string[]} */ 
        const middleSnapshots = [];
        /** @type {string[]} */ 
        const oldSnapshots = [];

        for (const snapshotName of snapshots) {
            const isCorrected = Snapshot.isCorrectedName(snapshotName);
            if (!isCorrected) {
                continue;
            }
            const snapshot = new Snapshot(snapshotName);
            const snapshotTime = snapshot.getDate();
            if (snapshotTime > hourLimit) {
                youngSnapshots.push(snapshotName);
            }
            else if (snapshotTime > dayLimit) {
                middleSnapshots.push(snapshotName);
            }
            else {
                oldSnapshots.push(snapshotName);
            }
        }
        const result = {youngSnapshots, middleSnapshots, oldSnapshots};
        return result;
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
        const filesystems = await ZfsUtilities.filesystemList(this.#name);
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
        // take the new snapshot on the filesystem and remember the new snapshot.
        const snapshot = Snapshot.createSnapshot();

        const newSnapshot = await ZfsUtilities.takeSnapshot(snapshot.name, this.#name);
        this.#newSnapshot = newSnapshot;
    }

    /**
     * Purge snapshots on the ZFS filesystem.
     */
     async purgeSnapshots() {
        const snapshotList = await this.getSnapshotList();
        const snapshotsByGeneration = await snapshotList.getSnapshotsByGenerations();

        // purge the snapshots one snapshot per one day on the day period.
        await this.#destroySnapshot(snapshotsByGeneration.middleSnapshots, 1);

        // purge the snapshots one snapshot per one week on the week period.
        await this.#destroySnapshot(snapshotsByGeneration.oldSnapshots, 7);

        // purge the snapshots over number of the keeping them on the week period.
        await this.#destroySnapshotNumber(snapshotsByGeneration.oldSnapshots, Configure.SNAPSHOT_KEEP_WEEKS);
    }

    /**
     * Destroy snapshots on the ZFS filesystem.
     * @param {string[]} snapshots a array of snapshots.
     * @param {number} offset a date offset to decrease the base date.
     */
     async #destroySnapshot(snapshots, offset) {
        // minimum date on JavaScript
        let earliestSnapshotDate = new Date(-8640000000000000);

        for (const snapshotName of snapshots) {
            const isCorrected = Snapshot.isCorrectedName(snapshotName);
            if (!isCorrected) {
                // the snapshot is not Elephant Backup's snapshot.
                continue;
            }
            const snapshot = new Snapshot(snapshotName);
            const snapshotDate = snapshot.getDate();
            if (snapshotDate >= earliestSnapshotDate) {
                // the next date to keep snapshot. 
                earliestSnapshotDate = snapshotDate;
                earliestSnapshotDate.setDate(earliestSnapshotDate.getDate() + offset);
            }
            else {
                await ZfsUtilities.destroySnapshot(snapshotName, this.#name);
            }
        }
     }

    /**
     * Destroy snapshots on the ZFS filesystem with the number of keeping snapshots.
     * @param {string[]} snapshots a array of snapshots.
     * @param {number} number a number of keeping snapshots.
     */
     async #destroySnapshotNumber(snapshots, number) {
        const destroyNumber = snapshots.length - number;

        for (let counter = 0; counter < destroyNumber; counter++) {
            await ZfsUtilities.destroySnapshot(snapshots[number], this.#name);
        }
     }

    /**
     * Get the snapshot list.
     * @return {Promise<SnapshotList>} the list of the snapshots on this filesystem.
     */
     async getSnapshotList() {
        const options = Options.getInstance();
        const optionalSnapshot = options.options.dryRun ? this.#newSnapshot : null;
        const snapshots = await ZfsUtilities.snapshotList(this.#name, optionalSnapshot);
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
