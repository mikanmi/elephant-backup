/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

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
     * @returns the snapshot if found, otherwise null.
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
     * @returns the latest snapshot if exist, otherwise null.
     */
     getEarliest() {
        let result = null;
        if (this.#snapshots.length > 0) {
            result = this.#snapshots[0];
        }

        return result;
     }

    /**
     * Get the latest snapshot.
     * @returns the latest snapshot if exist, otherwise null.
     */
     getLatest() {
        let result = null;

        const length = this.#snapshots.length;
        if (length > 0) {
            result = this.#snapshots[length-1];
        }

        logger.debug(result);

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
    create(dataset) {
        ZfsUtilities.createZfsDataset(dataset, this.#name);
        return new ZfsFilesystem(`${this.#name}/${dataset}`);
    }

    /**
     * Make a ZfsFilesystem instance.
     * @param {string} dataset the name of a ZFS dataset to make a instance.
     * @returns a ZfsFilesystem instance made from dataset.
     */
    make(dataset) {
        return new ZfsFilesystem(`${this.#name}/${dataset}`);
    }

    /**
     * back up snapshots between first and last on the filesystem.
     * @param {string} archive a ZFS filesystem to store the filesystem.
     * @param {string} first the first snapshot.
     * @param {string} last the last snapshot. send only one snapshot if last is empty string.
     */
    backup(archive, first, last = '') {
        ZfsUtilities.sendAndReceiveZfsfilesystem(archive, this.#name, first, last);
    }

    /**
     * Take the new snapshot on the filesystem.
     */
    takeNewSnapshot() {
        // take the new snapshot and get the snapshot list on the filesystem.
        const snapshot = ZfsUtilities.takeSnapshot(this.#name);
        this.#newSnapshot = snapshot;
    }

    /**
     * Get the snapshot list
     * @return the list of the snapshots on this filesystem.
     */
     getSnapshots() {
        const snapshots = ZfsUtilities.snapshotList(this.#name, this.#newSnapshot);
        const list = new SnapshotList(snapshots);

        return list;
     }

    /**
     * Diff a snapshot and the current.
     * @param {string} snapshot a snapshot on the ZFS filesystem.
     */
     diff(snapshot) {
        ZfsUtilities.diff(`${this.#name}@${snapshot}`, this.#name);
     }

    get name () {
        return this.#name;
    }
}