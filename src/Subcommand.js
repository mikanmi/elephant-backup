/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { Options, CommandType } from './Options.js';
import { Logger } from './Logger.js';
import { ZfsFilesystem } from './ZfsFilesystem.js';
import { ZfsUtilities } from './ZfsUtilities.js';

const logger = Logger.getLogger()

export class Subcommand {

    /**
     * Create a Subcommand.
     * @param {CommandType} type a Subcommand type.
     * @return the Subcommand instance created with the subcommand type.
     */
    static create(type) {
        let subcommand;
        switch (type) {
        case CommandType.BACKUP:
            subcommand = new BackupSubcommand(type);
            break;
        case CommandType.SNAPSHOT:
            subcommand = new SnapshotSubcommand(type);
            break;
        case CommandType.SYSTEMD_INSTALL:
        case CommandType.SYSTEMD_UNINSTALL:
                subcommand = new SytemdSubcommand(type);
            break;
        case CommandType.DIFF:
        default: // fail safe
            subcommand = new DiffSubcommand(type);
            break;
        }
        return subcommand;
    }

    commandType;

    /**
     * Create a Subcommand instance.
     * @param {CommandType} type a Subcommand type.
     * @return the Subcommand instance created with the subcommand type.
     */
    constructor(type) {
        this.commandType = type;
    }

    /**
     * Run the subcommand.
     */
    // NOSNOAR
    async run() {
        // nothing to do.
    }

    /**
     * The ZFS filesystems of the command options are accessible or exit.
     * @returns true if accessible, otherwise false.
     */
    async accessibleFilesystems() {
        return false;
    }

    async checkCondition() {
        const options = Options.getInstance();

        if (!options.options.dryRun && !ZfsUtilities.isSuperUser()) {
            // run the diff Subcommand of Elephant Backup on a normal user.
            logger.exit(`Run the ${options.subcommand} on the SUPER user.`);
        }

        const accessible = await this.accessibleFilesystems();
        if (!accessible) {
            logger.exit('Any ZFS filesystems are not accessible.');
        }
    }
}

class BackupSubcommand extends Subcommand {
    /**
     * The ZFS filesystems of the command options are accessible or exit.
     * @returns true if accessible, otherwise exit.
     */
    async accessibleFilesystems() {
        const list = await ZfsUtilities.filesystemList();

        const options = Options.getInstance();
        const archive = options.options.archive;
        const targets = options.targets;

        // exit if the ZFS filesystems, which a user specifies, do not exist on the machine.
        if (!list.includes(archive)) {
            logger.error(`An archive ZFS pool/dataset is not exist: ${archive}`);
            return false;
        }

        for (const target of targets) {
            if (!list.includes(target)) {
                logger.error(`A primary ZFS pool/dataset is not exist: ${target}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Run the 'backup' subcommand.
     */
    async run() {
        logger.debug(`run 'backup' subcommand`);

        await this.checkCondition();

        const commandLine = Options.getInstance();
        const targets = commandLine.targets;
        const archive = commandLine.options.archive;

        // start backup process.
        for (const target of targets) {
            await this.#backup(target, archive);
        }
    }

    /**
     * Back up the primary ZFS filesystem to the archive ZFS filesystem.
     * @param {string} primary a filesystem to backup.
     * @param {string} archive a filesystem to store.
     */
    async #backup(primary, archive) {
        logger.info(`Start to back up from [${primary}] to [${archive}]`);

        const primaryFilesystem = new ZfsFilesystem(primary);
        const archiveParentFilesystem = new ZfsFilesystem(archive);

        // create a ZFS dataset from the same name as the primary on the archive filesystem.
        const archiveFilesystem = await archiveParentFilesystem.create(primaryFilesystem.name);

        // take the new snapshot now.
        await primaryFilesystem.takeNewSnapshot();

        const prySnapshot = await primaryFilesystem.getSnapshotList();
        const bakSnapshots = await archiveFilesystem.getSnapshotList();

        // find the latest of common snapshots between the primary and the archive.
        let latestOfCommonSnapshots = prySnapshot.findLatest(bakSnapshots);

        // when the first backup only
        if (latestOfCommonSnapshots == null) {
            const earliestPrimarySnapshot = prySnapshot.getEarliest() || 'Unexpected condition';

            // estimate the backup size of the earliest snapshot of the primary.
            const firstSize = await primaryFilesystem.estimateBackupSize(earliestPrimarySnapshot);
            logger.print(`The first backup size of ${primaryFilesystem.name}: ${firstSize}`);
            // back up the earliest snapshot of the primary.
            await primaryFilesystem.backup(archiveFilesystem.name, earliestPrimarySnapshot);

            // and continue to back up the remains of its snapshots.
            latestOfCommonSnapshots = earliestPrimarySnapshot;
        }

        // When the incremental backup
        const latestSnapshot = prySnapshot.getLatest() ?? 'Unexpected condition';

        if (latestOfCommonSnapshots == latestSnapshot) {
            // When the archive is up-to-date, skip the backup process.
            logger.print('Archive is Up-To-Date.');
            return;
        }

        // estimate the backup size of the primary of the snapshots between earliest and latest.
        const incrementalSize = await primaryFilesystem.estimateBackupSize(latestOfCommonSnapshots, latestSnapshot);
        logger.print(`The incremental backup size of ${primaryFilesystem.name}: ${incrementalSize}`);

        // back up the primary of the snapshots between earliest and latest.
        await primaryFilesystem.backup(archiveFilesystem.name, latestOfCommonSnapshots, latestSnapshot);
    }
}

class DiffSubcommand extends Subcommand {
    /**
     * The ZFS filesystems of the command options are accessible or exit.
     * @returns true if accessible, otherwise exit.
     */
     async accessibleFilesystems() {
        const list = await ZfsUtilities.filesystemList();

        const options = Options.getInstance();
        const archive = options.options.archive;
        const targets = options.targets;

        // exit if the ZFS filesystems, which a user specifies, do not exist on the machine.
        if (!list.includes(archive)) {
            logger.error(`An archive ZFS pool/dataset is not exist: ${archive}`);
            return false;
        }

        for (const target of targets) {
            if (!list.includes(target)) {
                logger.error(`The primary ZFS pool/dataset is not exist: ${target}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Run the 'diff' subcommand.
     */
    async run() {
        logger.debug(`Run 'diff' subcommand`);
        const commandLine = Options.getInstance();

        await this.checkCondition();

        const targets = commandLine.targets;
        const archive = commandLine.options.archive;

        // start diff process.
        for (const target of targets) {
            await this.#diff(target, archive);
        }
    }

    /**
     * diff the primary ZFS filesystem and the archive ZFS filesystem.
     * @param {string} primary a ZFS filesystem to backup.
     * @param {string} archive a ZFS filesystem to store.
     */
    async #diff(primary, archive) {
        logger.info(`Start to diff: from [${primary}] to [${archive}]`);

        // New the ZFS instance from the primary ZFS filesystem.
        const primaryFilesystem = new ZfsFilesystem(primary);
        // Make a ZFS instance from the same name as the primary on the archive ZFS filesystem.
        const archiveParentFilesystem = new ZfsFilesystem(archive);

        // print the name of the primary and archive ZFS filesystems.
        const archiveFilesystem = archiveParentFilesystem.open(primaryFilesystem.name);
        logger.print(`diff ${primaryFilesystem.name} and ${archiveFilesystem.name} `);

        let message = '';
        // Get all of the ZFS datasets contained in the primary ZFS filesystem.
        const primaryDatasetFilesystems = await primaryFilesystem.openRecursively();
        for (const primaryDatasetFilesystem of primaryDatasetFilesystems) {
            const archiveDatasetFilesystem = archiveParentFilesystem.open(primaryDatasetFilesystem.name);            

            const primarySnapshots = await primaryDatasetFilesystem.getSnapshotList();
            const archiveSnapshots = await archiveDatasetFilesystem.getSnapshotList();
    
            // Find the latest of common snapshots between the primary and the archive.
            const latestOfCommonSnapshots = primarySnapshots.findLatest(archiveSnapshots) || 'Unexpected Snapshot';

            message += await primaryDatasetFilesystem.diff(latestOfCommonSnapshots);
        }

        // print no difference of the primary and the archive if no differences.
        if (message == '') {
            logger.print(`${primaryFilesystem.name} and ${archiveFilesystem.name} are no differences`);
        }
    }
}

class SnapshotSubcommand extends Subcommand {
    /**
     * The ZFS filesystems of the command options are accessible or exit.
     * @returns true if accessible, otherwise exit.
     */
     async accessibleFilesystems() {
        // exit if the ZFS filesystems, which a user specifies, do not exist on the machine.
        const list = await ZfsUtilities.filesystemList();

        const options = Options.getInstance();
        const targets = options.targets;

        for (const target of targets) {
            if (!list.includes(target)) {
                logger.warn(`A ZFS pool/dataset to taking a snapshot is not exist: ${target}`);
                logger.warn(`Skipping a snapshot on the ZFS pool/dataset: ${target}`);
            }
        }

        return true;
    }

    /**
     * Run the 'snapshot' subcommand.
     */
    async run() {
        logger.debug(`Run 'snapshot' subcommand`);

        await this.checkCondition();

        const list = await ZfsUtilities.filesystemList();

        const options = Options.getInstance();
        const targets = options.targets;

        if (options.options.list) {
            await this.#showSnapshots(targets);
            return;
        }

        // start takeing a snapshot process.
        for (const target of targets) {
            if (list.includes(target)) {
                await this.#takeSnapshot(target);
            }
        }
    }

    /**
     * Take a snapshot on the ZFS filesystem.
     * @param {string} filesystem a ZFS filesystem which you take on.
     */
    async #takeSnapshot(filesystem) {
        logger.info(`Start to snapshot: on [${filesystem}]`);

        // New the ZFS instance from a ZFS filesystem.
        const zfsFilesystem = new ZfsFilesystem(filesystem);

        // take a new snapshot.
        await zfsFilesystem.takeNewSnapshot();

        // purge some of oldest snapshots.
        await zfsFilesystem.purgeSnapshots();
    }

    /**
     * Show the Elephant Backup snapshots.
     * @param {string[]} filesystems An array of ZFS filesystems which we show snapshots of.
     */
    async #showSnapshots(filesystems) {
        logger.info(`Start to show snapshots: on [${filesystems}]`);

        for (const filesystem of filesystems) {
            // New the ZFS instance from a ZFS filesystem.
            const zfsFilesystem = new ZfsFilesystem(filesystem);

            const snapshotByPeriod = await zfsFilesystem.getSnapshotsByPeriod();

            logger.print(`'${zfsFilesystem.name}' has the following snapshots:`);
            logger.print(snapshotByPeriod);
        }
    }

}

class SytemdSubcommand extends Subcommand {
    /**
     * The ZFS filesystems of the command options are accessible or exit.
     * @returns true if accessible, otherwise exit.
     */
     async accessibleFilesystems() {

        switch (this.commandType) {
        case CommandType.SYSTEMD_INSTALL:
            // nothing to do.
            break;
        case CommandType.SYSTEMD_UNINSTALL:
            // success always if command type is systemd uninstall.
            return true;
        }

        // exit if the ZFS filesystems, which a user specifies, do not exist on the machine.
        const list = await ZfsUtilities.filesystemList();

        const options = Options.getInstance();
        const targets = options.targets;

        for (const target of targets) {
            if (!list.includes(target)) {
                logger.error(`A ZFS pool/dataset to run auto-snapshot is not exist: ${target}`);
                return false;
            }
        }
        return true;
    }

    /**
     * Run the 'systemd' subcommand.
     */
     async run() {
        logger.debug(`Run 'systemd' subcommand`);

        await this.checkCondition();

        const options = Options.getInstance();
        const targets = options.targets;

        const enable = this.commandType == CommandType.SYSTEMD_INSTALL;

        await ZfsUtilities.enableSystemd(enable, targets);
    }
}
