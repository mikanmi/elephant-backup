/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
 'use strict'

import path from "node:path";

export class Configure {
    /** @type {string} The absolute path of the log file to store an application log. */
    static LOG_FILE_PATH = path.join('/var/log/', 'elephant-backup.log');

    /** @type {string} The prefix of the name of snapshots */
    static PREFIX_SNAPSHOT = 'elephant-backup';

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
