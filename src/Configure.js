/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
 'use strict'

import path from "node:path";
import os from "node:os";
import * as fsPromises from 'node:fs/promises';

export class Configure {

    /**
     * Get the absolute path of Elephant Backup module. 
     * @returns {Promise<string>} The absolute path of the elephant backup directory.
     */
    static async getElephantBackupPath() {
        let elephantPath = process.argv[1];
        const lstat = await fsPromises.lstat(elephantPath);
        if (lstat.isSymbolicLink()) {
            const link = await fsPromises.readlink(elephantPath);
            elephantPath = path.resolve(path.dirname(elephantPath), link);
        }
        elephantPath = path.resolve(elephantPath, '..', '..');
        return elephantPath;
    }

    static LOG_START_SENTENCE = '===== Start Elephant Backup =====';

    /** @type {string} The absolute path of the log file to store an application log. */
    static LOG_FILE_PATH = path.join('/var/log/', 'elephant-backup.log');

    /** @type {number} The maximum size of the log file */
    static LOG_FILE_SIZE = 5 * 1024 * 1024; // 5 MiB

    /** @type {string} The absolute path of the lock file used in Semaphore */
    static LOG_REFERENCE_FILE_PATH = path.join(os.tmpdir(), 'elephant-backup.reference');

    /** @type {string} The prefix of the name of snapshots */
    static PREFIX_SNAPSHOT = 'elephant';

    /** @type {number} The number of weekly snapshots keeping */
    static SNAPSHOT_KEEP_WEEKS = 104;

    /** @type {number} The number of daily snapshots keeping */
    static SNAPSHOT_KEEP_DAYS = 30;

    /** @type {number} The number of hourly snapshots keeping */
    static SNAPSHOT_KEEP_HOURS = 24;

    /** @type {string} The 'enable' behavior of systemd subcommand */
    static SYSTEMD_BEHAVIOR_ENABLE = 'enable';

    /** @type {string} The 'disable' behavior of systemd subcommand */
    static SYSTEMD_BEHAVIOR_DISABLE = 'disable';
}
