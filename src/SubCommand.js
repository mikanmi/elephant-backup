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

export class SubCommand {

    /**
     * Create a SubCommand.
     * @param {CommandType} type a SubCommand type.
     * @return the SubCommand instance created with the SubCommand type.
     */
    static create(type) {
        let subCommand;
        switch (type) {
        case CommandType.BACKUP:
            subCommand = new BackupSubCommand(type);
            break;
        case CommandType.SNAPSHOT:
            subCommand = new SnapshotSubCommand(type);
            break;
        case CommandType.SYSTEMD_INSTALL:
        case CommandType.SYSTEMD_UNINSTALL:
                subCommand = new SytemdSubcommand(type);
            break;
        case CommandType.DIFF:
        default: // fail safe
            subCommand = new DiffSubCommand(type);
            break;
        }
        return subCommand;
    }

    commandType;

    /**
     * Create a sub-command instance.
     * @param {CommandType} type a sub-command type.
     * @return the sub-command instance created with the sub-command type.
     */
    constructor(type) {
        this.commandType = type;
    }

    /**
     * Launch the sub-command.
     */
    async launch() {
        const accessible = await this.accessibleFilesystems();
        if (!accessible) {
            logger.exit('Any ZFS filesystems are not accessible.');
        }

        this.run();
    }

    /**
     * Run the sub-command.
     */
    // NOSNOAR
    async run() {
        // nothing to do.
    }

    /**
     * The ZFS filesystems of the command options are accessible or not.
     * @returns {Promise<boolean>} true if accessible, otherwise false.
     */
    async accessibleFilesystems() {
        const filesystems = await ZfsFilesystem.getRoots();

        const option = CommandLine.getOption();
        const archive = option.archive;
        const zpools = option.arguments;

        // exit if the filesystems of 'targets' involve the same filesystem.
        const sortedZpools = zpools.sort();
        // notice: the max value of the index decrease 1 on the max value of the element.
        for (let index = 0; index < sortedZpools.length - 1; index++) {
            if (sortedZpools[index] === sortedZpools[index + 1]) {
                logger.error(`A primary ZFS zpool/dataset is duplicated: ${sortedZpools[index]}`);
                return false;
            }
        }

        // exit if the filesystems of 'targets' are not exist on the machine.
        for (const zpool of zpools) {
            if (!filesystems.some(e => e.name === archive)) {
                logger.error(`A primary ZFS zpool/dataset is not exist: ${zpool}`);
                return false;
            }
        }

        // exit if 'archive' filesystem is not exist on the machine.
        if (!filesystems.some(e => e.name === archive)) {
            logger.error(`An archive ZFS zpool/dataset is not exist: ${archive}`);
            return false;
        }

        return true;
    }

    /**
     * Get the latest of common snapshots.
     * @param {ZfsFilesystem} first 
     * @param {ZfsFilesystem} second
     * @returns {Promise<string|null>} the latest of common snapshots
     */
    async getlatestOfCommonSnapshots(first, second) {
        const firstSnapshotList = await first.getSnapshotList();
        const secondSnapshotList = await second.getSnapshotList();

        // find the latest of common snapshots between the first and the second ZFS filesystem.
        const latest = firstSnapshotList.findLatest(secondSnapshotList);

        return latest;
    }
}

/**
 * 'backup' sub-command class
 */
class BackupSubCommand extends SubCommand {
    /**
     * The ZFS filesystems of the command options are accessible or not.
     * @returns {Promise<boolean>} true if accessible, otherwise false.
     */
    async accessibleFilesystems() {
        const filesystems = await ZfsFilesystem.getRoots();

        const option = CommandLine.getOption();
        const archive = option.archive;

        const baseResult = await super.accessibleFilesystems();
        if (!baseResult) {
            return baseResult;
        }

        // exit if 'archive' filesystem is not exist on the machine.
        if (!filesystems.some(e => e.name === archive)) {
            logger.error(`An archive ZFS zpool/dataset is not exist: ${archive}`);
            return false;
        }

        return true;
    }

    /**
     * Run the 'backup' sub-command.
     */
    async run() {
        logger.debug(`run 'backup' sub-command`);

        const option = CommandLine.getOption();
        const roots = await ZfsFilesystem.getRoots();
        const archive = option.archive;

        // start the backup process.
        for (const primary of option.arguments) {
            // Get the primary filesystem.
            const primaryFilesystem = roots.find((e) => e.name === primary);
            if (!primaryFilesystem) {
                throw new Error(`primaryFilesystem is undefined. primary: ${primary}`);
            }
            // Get the archive filesystem.
            const archiveFilesystem = roots.find((e) => e.name === archive);
            if (!archiveFilesystem) {
                throw new Error(`archiveFilesystem is undefined. archive: ${archive}`);
            }

            await this.#backup(primaryFilesystem, archiveFilesystem);
        }
    }

    /**
     * Back up the primary ZFS filesystem to the archive ZFS filesystem.
     * @param {ZfsFilesystem} primaryFilesystem a filesystem to backup.
     * @param {ZfsFilesystem} archiveFilesystem a filesystem to store.
     */
    async #backup(primaryFilesystem, archiveFilesystem) {
        logger.info(`Start to back up from [${primaryFilesystem.name}] to [${archiveFilesystem.name}]`);

        // create a ZFS dataset from the same name as the primary on the archive filesystem.
        const archiveChildFilesystem = await archiveFilesystem.create(primaryFilesystem.name);

        // take the new snapshot now.
        await primaryFilesystem.takeNewSnapshot();

        const primarySnapshots = await primaryFilesystem.getSnapshotList();
        let latestOfCommonSnapshot = 
                await this.getlatestOfCommonSnapshots(primaryFilesystem, archiveChildFilesystem);

        // when the first backup
        if (latestOfCommonSnapshot == null) {
            const earliestPrimarySnapshot = primarySnapshots.getEarliest() || 'Unexpected condition';

            // estimate the backup size of the earliest snapshot of the primary.
            const firstSize = await primaryFilesystem.estimateBackupSize(earliestPrimarySnapshot);
            logger.print(`The first backup size of ${primaryFilesystem.name}: ${firstSize}`);
            // back up the earliest snapshot of the primary.
            await primaryFilesystem.backup(archiveChildFilesystem.name, earliestPrimarySnapshot);

            // and continue to the following incremental backup.
            latestOfCommonSnapshot = earliestPrimarySnapshot;
        }

        // When the incremental backup
        const latestSnapshot = primarySnapshots.getLatest() ?? 'Unexpected condition';

        if (latestOfCommonSnapshot === latestSnapshot) {
            // When the archive is up-to-date, skip the backup process.
            logger.print('Archive is Up-To-Date.');
            return;
        }

        // estimate the backup size of the primary of the snapshots between earliest and latest.
        const incrementalSize = await primaryFilesystem.estimateBackupSize(latestOfCommonSnapshot, latestSnapshot);
        logger.print(`The incremental backup size of ${primaryFilesystem.name}: ${incrementalSize}`);

        // back up the primary of the snapshots between earliest and latest.
        await primaryFilesystem.backup(archiveChildFilesystem.name, latestOfCommonSnapshot, latestSnapshot);
    }
}

/**
 * 'diff' sub-command class
 */
class DiffSubCommand extends SubCommand {
    /**
     * The ZFS filesystems of the command options are accessible or not.
     * @returns {Promise<boolean>} true if accessible, otherwise false.
     */
    async accessibleFilesystems() {
        const filesystems = await ZfsFilesystem.getRoots();

        const option = CommandLine.getOption();
        const archive = option.archive;

        const baseAccessible = await super.accessibleFilesystems();
        if (!baseAccessible) {
            return baseAccessible;
        }

        // exit if 'archive' filesystem is not exist on the machine.
        if (!filesystems.some(e => e.name === archive)) {
            logger.error(`An archive ZFS zpool/dataset is not exist: ${archive}`);
            return false;
        }

        return true;
    }

    /**
     * Run the 'diff' sub-command.
     */
    async run() {
        logger.debug(`Run 'diff' sub-command`);

        const roots = await ZfsFilesystem.getRoots();
        const option = CommandLine.getOption();
        const archive = option.archive;

        // start diff process.
        for (const primary of option.arguments) {
            // Get the primary filesystem.
            const primaryFilesystem = roots.find((e) => e.name === primary);
            if (!primaryFilesystem) {
                throw new Error(`primaryFilesystem is undefined. primary: ${primary}`);
            }
            // Get the archive filesystem.
            const archiveFilesystem = roots.find((e) => e.name === archive);
            if (!archiveFilesystem) {
                throw new Error(`archiveFilesystem is undefined. archive: ${archive}`);
            }

            await this.#diff(primaryFilesystem, archiveFilesystem);
        }
    }

    /**
     * diff the primary ZFS filesystem and the archive ZFS filesystem.
     * @param {ZfsFilesystem} primaryFilesystem a ZFS filesystem to backup.
     * @param {ZfsFilesystem} archiveFilesystem a ZFS filesystem to store.
     */
    async #diff(primaryFilesystem, archiveFilesystem) {
        logger.info(`Start to diff: from [${primaryFilesystem.name}] to [${archiveFilesystem.name}]`);

        // Open the ZFS dataset from the same name as the primary filesystem.
        const archiveDataset = await archiveFilesystem.open(primaryFilesystem.name);
        const exist = await archiveDataset.exist();
        if (!exist) {
            logger.print(`${primaryFilesystem.name} is not archived on ${archiveFilesystem.name} yet.`);
            return;
        }

        logger.print(`diff ${primaryFilesystem.name} and ${archiveDataset.name} `);

        let message = '';
        // Get all of the ZFS datasets contained in the primary ZFS filesystem.
        const primaryDatasets = await primaryFilesystem.openRecursively();
        for (const primaryDataset of primaryDatasets) {
            const archiveDatasetChild = await archiveFilesystem.open(primaryDataset.name);
            const exist = await archiveDatasetChild.exist();
            if (!exist) {
                // Found not-archived dataset and skip the not-archived dataset.
                // the parent already have printed the not-archived dataset as added on the parent's diff. 
                logger.info(`${primaryDataset.name} is not archived on ${archiveDatasetChild.name} yet.`);
                continue;
            }

            const latestOfCommonSnapshot =
                    await this.getlatestOfCommonSnapshots(primaryDataset, archiveDatasetChild);
            if (!latestOfCommonSnapshot) {
                logger.print(`${primaryFilesystem.name} is not archived on ${archiveDataset} yet.`);
                return;
            }

            message += await primaryDataset.diff(latestOfCommonSnapshot);
        }

        // print no difference of the primary and the archive if no differences.
        if (message == '') {
            logger.print(`${primaryFilesystem.name} and ${archiveDataset.name} are no differences`);
        }
    }
}

/**
 * 'snapshot' sub-command class
 */
class SnapshotSubCommand extends SubCommand {
    /**
     * The ZFS filesystems of the command options are accessible or not.
     * @returns {Promise<boolean>} true if accessible, otherwise false.
     */
     async accessibleFilesystems() {
        // Later, confirm argument ZFS filesystem exist or not.
        return true;
    }

    /**
     * Run the 'snapshot' sub-command.
     */
    async run() {
        logger.debug(`Run 'snapshot' sub-command`);

        const roots = await ZfsFilesystem.getRoots();
        const option = CommandLine.getOption();

        const takeOrShowFunction =
                option.list ? this.#showSnapshots : this.#takeSnapshot;

        // start the process to take a snapshot.
        for (const filesystemName of option.arguments) {
            // Get the filesystem.
            const filesystem = roots.find((e) => e.name === filesystemName);
            if (filesystem) {
                await takeOrShowFunction(filesystem);
            }
            else {
                logger.warn(`A ZFS pool/dataset to taking a snapshot is not exist: ${filesystemName}`);
                logger.warn(`Skipping a snapshot on the ZFS pool/dataset: ${filesystemName}`);
            }
        }
    }

    /**
     * Take a snapshot on the ZFS filesystem.
     * @param {ZfsFilesystem} filesystem a ZFS filesystem on which you take a snapshot.
     */
    async #takeSnapshot(filesystem) {
        logger.info(`Start to snapshot: on [${filesystem.name}]`);

        // take a new snapshot.
        await filesystem.takeNewSnapshot();

        // purge some of oldest snapshots.
        await filesystem.purgeSnapshots();
    }

    /**
     * Show the snapshots on the ZFS filesystem.
     * @param {ZfsFilesystem} filesystem a ZFS filesystem on that you show snapshots.
     */
    async #showSnapshots(filesystem) {
        logger.info(`Start to show snapshots: on [${filesystem.name}]`);

        const snapshotList = await filesystem.getSnapshotList();
        const snapshotsByGeneration = await snapshotList.getSnapshotsByGenerations();

        logger.print(`'${filesystem.name}' has the following snapshots:`);
        logger.print(snapshotsByGeneration);
    }
}

class SytemdSubcommand extends SubCommand {
    /**
     * The ZFS filesystems of the command options are accessible or not.
     * @returns {Promise<boolean>} true if accessible, otherwise false.
     */
     async accessibleFilesystems() {

        if (this.commandType == CommandType.SYSTEMD_UNINSTALL) {
            // always success if the 'systemd-uninstall' sub-command.
            return true;
        }
        const accessible = await super.accessibleFilesystems();

        return accessible;
    }

    /**
     * Run the 'systemd' sub-command.
     */
     async run() {
        logger.debug(`Run 'systemd' sub-command`);

        const option = CommandLine.getOption();
        const enable = this.commandType == CommandType.SYSTEMD_INSTALL;

        await ZfsUtilities.enableSystemd(enable, option.arguments);
    }
}
