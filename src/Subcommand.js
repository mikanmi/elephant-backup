/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { CommandLine, CommandType } from './CommandLine.js';
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
            subcommand = new BackupSubcommand();
            break;
        case CommandType.DIFF:
        default: // fail safe
            subcommand = new DiffSubcommand();
            break;
        }
        return subcommand;
    }

    /**
     * Run the subcommand.
     */
    async run() {
    }
}

class BackupSubcommand extends Subcommand {

    /**
     * Run the 'backup' subcommand.
     */
    async run() {
        logger.debug(`run 'backup' subcommand`);

        const commandLine = CommandLine.getInstance();
        const targets = commandLine.targets;
        const options = commandLine.options;

        // disable auto-snapshot property.
        ZfsUtilities.disableAutoSnapshotProperty(options.archive);

        // start backup process.
        for (const target of targets) {
            await this.#backup(target, options.archive);
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

        const prySnapshot = await primaryFilesystem.getSnapshots();
        const bakSnapshots = await archiveFilesystem.getSnapshots();

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

class DiffSubcommand extends Subcommand{
    /**
     * Run the 'diff' subcommand.
     */
    async run() {
        logger.debug(`Run 'diff' subcommand`);
        const commandLine = CommandLine.getInstance();

        const targets = commandLine.targets;
        const options = commandLine.options;

        // start differ process.
        for (const target of targets) {
            await this.#diff(target, options.archive);
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

        let message = '';
        // Get all of the ZFS datasets contained in the primary ZFS filesystem.
        const primaryDatasetFilesystems = await primaryFilesystem.openRecursively();
        for (const primaryDatasetFilesystem of primaryDatasetFilesystems) {
            const archiveDatasetFilesystem = archiveParentFilesystem.open(primaryDatasetFilesystem.name);            

            const primarySnapshots = await primaryDatasetFilesystem.getSnapshots();
            const archiveSnapshots = await archiveDatasetFilesystem.getSnapshots();
    
            // Find the latest of common snapshots between the primary and the archive.
            const latestOfCommonSnapshots = primarySnapshots.findLatest(archiveSnapshots) || 'Unexpected Snapshot';

            message += await primaryDatasetFilesystem.diff(latestOfCommonSnapshots);
        }
        if (message == '') {
            logger.print(`${primaryFilesystem.name} and ${archiveParentFilesystem.name} are no differences`);
        }
    }
}
