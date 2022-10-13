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

        await this.run();
    }

    /**
     * Run the sub-command.
     */
    // NOSNOAR
    async run() {
        // nothing to do.
    }

    /**
     * Confirm the ZFS filesystems of the command options are accessible or not.
     * @param {boolean} archive true if confirm the archive, false if skip it. 
     * @returns {Promise<boolean>} true if accessible, otherwise false.
     */
    async accessibleFilesystems(archive=true) {
        const filesystems = await ZfsFilesystem.getFilesystems();

        const option = CommandLine.getOption();
        const archiveArg = option.archive;
        const primaryArgs = option.arguments;

        // exit if launched with the duplicated 'primary' parameter.
        for (let index = 0; index < primaryArgs.length; index++) {
            if (primaryArgs.indexOf(primaryArgs[index]) != index) {
                logger.error(`A primary ZFS filesystem is duplicated: ${primaryArgs[index]}`);
                return false;
            }
        }

        // exit if the specified 'primary' is not exist on the machine.
        for (const primaryArg of primaryArgs) {
            if (!filesystems.some(f => f.Name === primaryArg)) {
                logger.error(`A primary ZFS filesystem is not exist: ${primaryArg}`);
                return false;
            }
        }

        if (archive) {
            // exit if the specified 'archive' filesystem is not exist on the machine.
            if (!filesystems.some(e => e.Name === archiveArg)) {
                logger.error(`An archive ZFS filesystem is not exist: ${archiveArg}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Get a ZFS filesystem from the name.
     * @param {string} filesystemName the name of the root ZFS filesystem. 
     * @returns {Promise<ZfsFilesystem>} a root ZFS filesystem
     * @throws {Error} if a ZFS filesystems is not exist on this machine.
     */
    async getZfsFilesystem(filesystemName) {
        const filesystems = await ZfsFilesystem.getFilesystems();

        // Get the primary filesystem.
        const filesystem = filesystems.find((e) => e.Name === filesystemName);
        if (!filesystem) {
            throw new Error(`A ZFS filesystem is undefined: ${filesystemName}`);
        }

        return filesystem;
    }
}

/**
 * 'backup' sub-command class
 */
class BackupSubCommand extends SubCommand {
    /**
     * Run the 'backup' sub-command.
     */
    async run() {
        logger.debug(`run 'backup' sub-command`);

        const option = CommandLine.getOption();
        const archiveArg = option.archive;

        // Get the archive filesystem.
        const archiveRoot = await this.getZfsFilesystem(archiveArg);

        // start the backup process.
        for (const primaryArg of option.arguments) {
            // Get the primary filesystem.
            const primary = await this.getZfsFilesystem(primaryArg);

            await this.#backup(primary, archiveRoot);
        }
    }

    /**
     * Back up the primary ZFS filesystem to the archive ZFS filesystem.
     * @param {ZfsFilesystem} primary a filesystem to backup.
     * @param {ZfsFilesystem} archiveRoot a filesystem to store.
     */
    async #backup(primary, archiveRoot) {
        logger.info(`Start to back up from [${primary.Name}] to [${archiveRoot.Name}]`);

        // create a ZFS dataset from the same name as the primary on the archive filesystem.
        const archive = archiveRoot.open(primary.Name);
        if (!archive.exist()) {
            await archive.create();
        }

        // take the new snapshot now.
        await primary.takeNewSnapshot();

        // get the latest of the snapshots, which the both of primary and archive hold.
        const primarySnapshotList = await primary.getSnapshotList();
        const archiveSnapshotList = await archive.getSnapshotList();
        let latestOfCommonSnapshot = primarySnapshotList.findLatest(archiveSnapshotList);

        // when the first backup
        if (latestOfCommonSnapshot == null) {
            const earliestPrimarySnapshot = primarySnapshotList.getEarliest();
            if (!earliestPrimarySnapshot) {
                throw new Error(`No snapshots on the ${primary.Name}`);
            }

            // estimate the backup size of the earliest snapshot of the primary.
            const firstSize = await primary.estimateBackupSize(earliestPrimarySnapshot);

            // notice the backup size.
            logger.print(`The first backup size of ${primary.Name}: ${firstSize}`);

            // back up the earliest snapshot of the primary.
            await primary.backup(archive.Name, earliestPrimarySnapshot);

            // and continue to the following incremental backup.
            latestOfCommonSnapshot = earliestPrimarySnapshot;
        }

        // When the incremental backup
        const latestSnapshot = primarySnapshotList.getLatest() ?? 'Unexpected condition';

        if (latestOfCommonSnapshot === latestSnapshot) {
            // When the archive is up-to-date, skip the backup process.
            // notice archive is already up-to-date.
            logger.print(`Archive is Up-To-Date: ${archive.Name}`);
        }
        else {
            // estimate the backup size of the primary of the snapshots between earliest and latest.
            const incrementalSize = await primary.estimateBackupSize(latestOfCommonSnapshot, latestSnapshot);
            // notice archive is already up-to-date.
            logger.print(`The incremental backup size of ${primary.Name}: ${incrementalSize}`);
            // back up the primary of the snapshots between earliest and latest.
            await primary.backup(archive.Name, latestOfCommonSnapshot, latestSnapshot);
        }
    }
}

/**
 * 'diff' sub-command class
 */
class DiffSubCommand extends SubCommand {
    /**
     * Same as the supper class.
     */
    async accessibleFilesystems() {
        const baseAccessible = await super.accessibleFilesystems();
        if (!baseAccessible) {
            return baseAccessible;
        }

        const option = CommandLine.getOption();
        const primaryArgs = option.arguments;
        const archiveArg = option.archive;

        const archiveRoot = await this.getZfsFilesystem(archiveArg);

        for (const primaryArg of primaryArgs) {
            // confirm weather the archive ZFS dataset exist or not.
            const archive = archiveRoot.open(primaryArg);
            const exist = archive.exist();
            if (!exist) {
                logger.error(`${primaryArg} is not archived on ${archive.Name} yet.`);
                return false;
            }
        }

        return true;
    }

    /**
     * Run the 'diff' sub-command.
     */
    async run() {
        logger.debug(`Run 'diff' sub-command`);

        const option = CommandLine.getOption();
        const archiveArg = option.archive;

        // Get the archive filesystem.
        const archiveRoot = await this.getZfsFilesystem(archiveArg);

        // start diff process.
        for (const primaryArg of option.arguments) {
            // Get the primary filesystem.
            const primary = await this.getZfsFilesystem(primaryArg);

            await this.#compare(primary, archiveRoot);
        }
    }

    /**
     * Compare the primary ZFS filesystem and the archive ZFS filesystem.
     * @param {ZfsFilesystem} primary a primary ZFS filesystem.
     * @param {ZfsFilesystem} archiveRoot a archive ZFS filesystem.
     */
    async #compare(primary, archiveRoot) {
        if (!await primary.mounted(true)) {
            logger.warn(`The primary ZFS filesystem containing unmounted filesystems: ${primary.Name}`);
            return;
        }

        const archive = archiveRoot.open(primary.Name);
        if (!await archive.mounted(true)) {
            logger.warn(`The archive ZFS dataset containing unmounted filesystems: ${archive.Name}`);
            return;
        }

        logger.print(`Printing the differences of ${primary.Name} and ${archive.Name}`);

        const descendant = await primary.openRecursively();
        const primaryDescendants = [primary, ...descendant];

        // the primary ZFS filesystem containing descendant ZFS datasets.
        // compare each primary and descendant ZFS filesystems.
        for (const descendant of primaryDescendants) {
            // descendant exists on the archive. 
            const another = archiveRoot.open(descendant.Name);
            const exist = another.exist();
            if (!exist) {
                logger.print(`an new ZFS dataset: ${descendant.Name}`);
                continue;
            }

            // print the differences between dataset and attempt.
            const excludes = primaryDescendants.filter(p => p !== descendant);
            await descendant.compare(another, excludes);
        }
    }
}

/**
 * 'snapshot' sub-command class
 */
class SnapshotSubCommand extends SubCommand {

    /**
     * Same as the supper class.
     */
    async accessibleFilesystems() {
        const accessible = await super.accessibleFilesystems(false);
        return accessible;
    }

    /**
     * Run the 'snapshot' sub-command.
     */
    async run() {
        logger.debug(`Running 'snapshot' sub-command`);

        const option = CommandLine.getOption();
        const takeOrShowFunction =
                option.list ? this.#showSnapshots : this.#takeSnapshot;

        // start to take a snapshot.
        for (const filesystemArg of option.arguments) {
            // Get the filesystem.
            const filesystem = await this.getZfsFilesystem(filesystemArg);
            await takeOrShowFunction(filesystem);
        }
    }

    /**
     * Take a snapshot on the ZFS filesystem.
     * @param {ZfsFilesystem} filesystem a ZFS filesystem on which you take a snapshot.
     */
    async #takeSnapshot(filesystem) {
        logger.info(`Take a snapshot on '${filesystem.Name}'`);

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
        logger.info(`Show the snapshots on '${filesystem.Name}'`);

        const snapshotList = await filesystem.getSnapshotList();
        const snapshotGenerationList = await snapshotList.getSnapshotsByGenerations();

        logger.print(`'${filesystem.Name}' has the following snapshots:`);
        logger.print(snapshotGenerationList);
    }
}

class SytemdSubcommand extends SubCommand {

    /**
     * Same as the supper class.
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
