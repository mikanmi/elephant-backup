/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
 'use strict'

export class Configure {

    /** @type {string} The absolute path of the log file to store an application log. */
    static LOG_FILE_PATH = `${process.cwd()}/elephant-backup.log`;

    /** @type {string} The absolute path of the log file to store an application log. */
    static PREFIX_SNAPSHOT = 'elephant-backup';

    /** @type {number} The absolute path of the log file to store an application log. */
    static SNAPSHOT_KEEP_WEEKS = 104;

    /** @type {number} The absolute path of the log file to store an application log. */
    static SNAPSHOT_KEEP_DAYS = 30;

    /** @type {number} The absolute path of the log file to store an application log. */
    static SNAPSHOT_KEEP_HOURS = 24;
}
