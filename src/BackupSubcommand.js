/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { CommandLine } from './CommandLine.js';
import { Logger } from './Logger.js';
import { ZfsFilesystem } from './ZfsFilesystem.js';
import { ZfsUtilities } from './ZfsUtilities.js';

const logger = Logger.getLogger()
const commandLine = CommandLine.getCommandLine();

export class BackupSubcommand {

    /**
     * Run the 'backup' subcommand.
     */
    run() {
        logger.debug(`run backup subcommand`);

        const targets = commandLine.targets;
        const options = commandLine.options;

        // exit if the specified ZFS filesystems do not exist on the machine.
        const list = ZfsUtilities.filesystemList();
        if (!list.includes(options.archive)) {
            logger.exit(`An archive ZFS pool/dataset is not exist: ${options.archive}`);
        }
        for (const target of targets) {
            if (!list.includes(target)) {
                logger.exit(`A primary ZFS pool/dataset is not exist: ${target}`);
            }
        }

        // disable auto-snapshot property.
        ZfsUtilities.disableAutoSnapshotProperty(options.archive);

        // start backup process.
        for (const target of targets) {
            this.#backup(target, options.archive);
        }
    }

    /**
     * Back up the primary ZFS filesystem to the archive ZFS filesystem.
     * @param {string} primary a filesystem to backup.
     * @param {string} archive a filesystem to store.
     */
    #backup(primary, archive) {
        logger.info(`Start to back up from [${primary}] to [${archive}]`);

        const primaryFilesystem = new ZfsFilesystem(primary);
        const archiveParentFilesystem = new ZfsFilesystem(archive);

        // Create a ZFS dataset from the same name as the primary on the archive filesystem.
        const archiveFilesystem = archiveParentFilesystem.create(primaryFilesystem.name);

        // Take the new snapshot now.
        primaryFilesystem.takeNewSnapshot();

        const prySnapshot = primaryFilesystem.getSnapshots();
        const bakSnapshots = archiveFilesystem.getSnapshots();

        // Find the latest of common snapshots between the primary and the archive.
        let latestOfCommonSnapshots = prySnapshot.findLatest(bakSnapshots);

        // When the first backup
        if (latestOfCommonSnapshots == null) {
            // back up the earliest snapshot of the primary.
            const earliestPrimarySnapshot = prySnapshot.getEarliest() || 'Unexpected condition';
            primaryFilesystem.backup(archiveFilesystem.name, earliestPrimarySnapshot);

            // and continue to back up the remains of its snapshots.
            latestOfCommonSnapshots = earliestPrimarySnapshot;
        }

        // When the incremental backup
        const latestSnapshot = prySnapshot.getLatest() || 'Unexpected condition';

        if (latestOfCommonSnapshots == latestSnapshot) {
            // When the archive is up-to-date, skip the backup process.
            logger.print('Archive is Up-To-Date.');
            return;
        }

        // back up the primary of the snapshots between earliest and latest.
        primaryFilesystem.backup(archiveFilesystem.name, latestOfCommonSnapshots, latestSnapshot);
    }
}



