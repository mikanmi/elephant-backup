/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import { CommandLine } from './CommandLine.js';
import { ZfsFilesystem } from './ZfsFilesystem.js';
import { ZfsUtilities } from './ZfsUtilities.js';
import { Logger } from './Logger.js';


const logger = Logger.getLogger()
const commandLine = CommandLine.getCommandLine();

export class DiffSubcommand {
    /**
     * Run the 'diff' subcommand.
     */
    run() {
        logger.debug(`Run 'diff' subcommand`);

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

        // start differ process.
        for (const target of targets) {
            this.#diff(target, options.archive);
        }
    }

    /**
     * diff the primary ZFS filesystem and the archive ZFS filesystem.
     * @param {string} primary a ZFS filesystem to backup.
     * @param {string} archive a ZFS filesystem to store.
     */
    #diff(primary, archive) {
        logger.info(`Start to diff: from [${primary}] to [${archive}]`);

        const primaryFilesystem = new ZfsFilesystem(primary);

        // Make a ZFS instance from the same name as the primary on the archive filesystem.
        const archiveParentFilesystem = new ZfsFilesystem(archive);
        const archiveFilesystem = archiveParentFilesystem.make(primaryFilesystem.name);

        const prySnapshot = primaryFilesystem.getSnapshots();
        const bakSnapshots = archiveFilesystem.getSnapshots();

        // Find the latest of common snapshots between the primary and the archive.
        let latestOfCommonSnapshots = prySnapshot.findLatest(bakSnapshots) || 'Unexpected Snapshot';

        primaryFilesystem.diff(latestOfCommonSnapshots);
    }
}



