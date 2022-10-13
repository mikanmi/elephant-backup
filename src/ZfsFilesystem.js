/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { Configure } from "./Configure.js";
import { Logger } from "./Logger.js";
import { CommandLine } from "./CommandLine.js";
import { Snapshot } from "./Snapshot.js";
import { ZfsUtilities } from "./ZfsUtilities.js";

import path from "node:path";
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as streamPromises from "node:stream/promises";
const { createHash } = await import('node:crypto');

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

    static #initialized = false;

    /** @type {string[]} */
    static #zfsFilesystemArray;

    /** @type {string} */
    #name;

    /** @type {string|null} */
    #newSnapshot = null;

    /**
     * Get all of the ZfsFilesystems on this machine.
     * @returns {Promise<ZfsFilesystem[]>} filesystems.
     */
    static async getFilesystems() {

        if (!ZfsFilesystem.#initialized) {
            ZfsFilesystem.#zfsFilesystemArray = await ZfsUtilities.filesystemList();
            ZfsFilesystem.#initialized = true;
        }

        const filesystemStrings = ZfsFilesystem.#zfsFilesystemArray;
        const filesystems = 
                filesystemStrings.map(f => new ZfsFilesystem(f));
        return filesystems;
    }

    /**
     * I designed this constructor with PRIVATE.
     * Construct a ZfsFilesystem with the filesystem variable.
     * @param {string} filesystem a ZFS filesystem.
     */
    constructor(filesystem) {
        this.#name = filesystem;
    }

    /**
     * Create a ZFS Dataset on the filesystem.
     */
    async create() {
        await ZfsUtilities.createZfsDataset(this.#name);
    }

    /**
     * Open the ZFS dataset on the filesystem.
     * @param {string} dataset the name of a ZFS dataset to open.
     * @returns {ZfsFilesystem} a ZfsFilesystem instance associated with the dataset.
     */
    open(dataset) {
        if (!this.exist()) {
            throw new Error(`ZFS filesystem does not exist: ${this.#name}`);
        }
        return new ZfsFilesystem(`${this.#name}/${dataset}`);
    }

    /**
     * Get a primary ZFS filesystem from an archive ZFS filesystem.
     * @returns {ZfsFilesystem} the primary ZFS filesystem
     */
    getPrimary() {
        if (!this.exist()) {
            throw new Error(`ZFS filesystem does not exist: ${this.#name}`);
        }

        const index = this.#name.indexOf('/');
        if (index == -1) {
            throw new Error(`ZFS filesystem does not have the primary name: ${this.#name}`);
        }
        const parentName = this.#name.substring(index + 1);
        return new ZfsFilesystem(parentName);
    }

    /**
     * Confirm a ZFS filesystem exists or not.
     * @returns {boolean} true if exist, false if not.
     */
    exist() {
        const included = ZfsFilesystem.#zfsFilesystemArray.includes(this.#name);
        return included;
    }

    /**
     * Open all of the ZFS datasets contained in the filesystem.
     * @returns {Promise<ZfsFilesystem[]>} a ZfsFilesystem array of all the ZFS datasets contained in the filesystem.
     */
     async openRecursively() {
        const filesystems = await ZfsUtilities.filesystemList(this.#name);

        const children = filesystems
                .filter(f => f.startsWith(this.#name))
                .filter(f => f !== this.#name);

        const childrenInstances = 
                children.map( c => new ZfsFilesystem(c));

        return childrenInstances;
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
        const option = CommandLine.getOption();

        const optionalSnapshot = option.dryRun ? this.#newSnapshot : null;
        const snapshots = await ZfsUtilities.snapshotList(this.#name, optionalSnapshot);
        const list = new SnapshotList(snapshots);

        return list;
     }

    /**
     * Whether this ZFS filesystem is mounted or not from the mounted property.
     * @param {boolean} recursive confirm this filesystem recursively.
     * @returns {Promise<boolean>} true if all the filesystems are mounted, otherwise false.
     */
    async mounted(recursive=false) {
        const values = await ZfsUtilities.getValues(this.#name, 'mounted', recursive);

        // remove the '-' value standing for snapshot.
        // snapshot is not ZFS pool and ZFS dataset.
        const filesystemValues = values.filter(value => value !== '-');
        const mounted = filesystemValues.every(v => v === 'yes');

        return mounted;
    }

    /** @type {string|null} */
    #mountPoint = null;
    /**
     * Get the mount point on the mountpoint property.
     * @returns {Promise<string>} the mount point of this ZFS filesystems.
     */
    async getMountPoint() {
        if (!this.#mountPoint) {
            const values = await ZfsUtilities.getValues(this.#name, 'mountpoint');
            this.#mountPoint = values[0];
        }
        return this.#mountPoint;
    }

    /**
     * Compare two ZFS filesystems, print the differences on the stdout. 

     * @param {ZfsFilesystem} another a ZFS filesystem to be compared
     * @param {ZfsFilesystem[]} excludes the ZFS filesystems excluded on the comparing.
     */
    async compare(another, excludes) {
        let onePath = await this.getMountPoint();
        onePath = path.join(onePath, '/');

        let anotherPath = await another.getMountPoint();
        anotherPath = path.join(anotherPath, '/');

        const excludePaths =
                await Promise.all(excludes.map(async (e) => {
                    const mountPoint = await e.getMountPoint();
                    return mountPoint;
                }));

        const compare = new Compare()
        await compare.compareDirectory(onePath, anotherPath, excludePaths)
    }

    get Name () {
        return this.#name;
    }
}

class Compare {
    /**
     * Compare two directories recursively, print the differences with the logger. 
     * 
     * @param {string} one the path of a directory.
     * @param {string} another the path of another directory.
     * @param {string[]} excludePaths the path to be excluded from comparing.
     */
    async compareDirectory(one, another, excludePaths) {
        if (excludePaths.includes(one)) {
            return;
        }

        const entries = await fsPromises.readdir(one, {withFileTypes: true});
        const directories = entries.filter(e => e.isDirectory());
        const files = entries.filter(e => !e.isDirectory());

        // compare the directories, move into the sub directory.
        for (const directory of directories) {
            const onePath = path.join(one, directory.name);
            const anotherPath = path.join(another, directory.name);
            if (!fs.existsSync(anotherPath)) {
                logger.print(` + ${onePath}/`);
            }

            // move into the sub directory.
            await this.compareDirectory(onePath, anotherPath, excludePaths);
        }

        // print all the files, if the appended directory.
        if (!fs.existsSync(another)) {
            for (const file of files) {
                const onePath = path.join(one, file.name);
                logger.print(` + ${onePath}`);
            }
            return;
        }

        // print the difference of files.
        this.#printDifference(files, one, another);
    }

    /**
     * Print the difference of files.
     * @param {fs.Dirent[]} files 
     * @param {string} one 
     * @param {string} another 
     */
    async #printDifference(files, one, another) {
        // print all of the removed files.
        const anotherNames = await fsPromises.readdir(another);
        for (const name of anotherNames) {
            const onePath = path.join(one, name);
            if (!fs.existsSync(onePath)) {
                logger.print(` - ${onePath}`);
            }
        }

        // print all of the appended and modified files.
        for (const file of files) {
            const onePath = path.join(one, file.name);
            const anotherPath = path.join(another, file.name);
            if (!fs.existsSync(anotherPath)) {
                logger.print(` + ${onePath}`);
                continue;
            }

            const stat = await fsPromises.lstat(anotherPath);
            if (stat.isDirectory()) {
                logger.print(` M ${onePath}`);
                continue;
            }

            const equal = await this.#equal(onePath, anotherPath);
            if (equal) {
                // logger.print(` K ${onePath}`)
            }
            else {
                logger.print(` M ${onePath}`);
            }
        }
    }

    /**
     * Compare files with the hash digest.
     * @param {string} one a file
     * @param {string} another another file
     * @returns {Promise<boolean>} true if one is the same as another, false if difference.
     */
    async #equal(one, another) {
        const oneDigest = await this.#digest(one);
        const anotherDigest = await this.#digest(another);
        const compareResult = oneDigest.compare(anotherDigest);
        const equal = compareResult == 0;

        return equal;
    }

    /**
     * Calculate the hash digest of a file.
     * @param {string} fileName the name of a file.
     * @returns {Promise<Buffer>} a hash digest.
     */
    async #digest(fileName) {
        const hash = createHash('sha512');

        const fileHandle = await fsPromises.open(fileName);
        try {
            const readStream = fileHandle.createReadStream();

            await streamPromises.pipeline(readStream, hash);
        }
        finally {
            fileHandle.close();
        }

        const digest = hash.digest();
        return digest;
    }
}
