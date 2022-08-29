/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
 'use strict'

import { Configure } from "./Configure.js";

export class Snapshot {

    #name;

    static createSnapshot() {
        const name = `${Configure.PREFIX_SNAPSHOT}-${Snapshot.#now}`;
        const instance = new Snapshot(name);
        return instance;
    }

    /**
     * Constructor
     * @param {string} name snapshot name 
     */
    constructor(name) {
        if (!Snapshot.isCorrectedName(name)) {
            throw new Error(`Snapshot is not Elephant Backup's: ${name}`);
        }
        this.#name = name;
    }

    /**
     * Get the name of this snapshot.
     * @returns {string} the name of this snapshot.
     */
    get name () {
        return this.#name;
    }

    /**
     * Get the date of creating this snapshot.
     * @returns {Date} a Date instance of creating this snapshot.
     */
    getDate() {
        const date = this.#name.slice(`${Configure.PREFIX_SNAPSHOT}-`.length);

        const dateElements = date.split('-');
        const dateTime = dateElements.pop() ?? 'unexpected time';
        for (let index = 0; index < 6; index+=2) {
            dateElements.push(dateTime.slice(index, index + 2));
        }

        const dateNumbers = dateElements.map(e => Number(e));
        const dateInstance = new Date(Date.UTC(dateNumbers[0], dateNumbers[1] - 1, dateNumbers[2],
                dateNumbers[3], dateNumbers[4], dateNumbers[5]));
        // UTC to Local Time
        dateInstance.setMinutes(dateInstance.getMinutes() + dateInstance.getTimezoneOffset());

        return dateInstance;
    }

    /**
     * @type{RegExp} Regular expression of the Elephant Backup snapshot
     * e.g., 'elephant-backup-2022-08-29-153407'
     */
    static #snapshotRegExp = new RegExp(`^${Configure.PREFIX_SNAPSHOT}\\-\\d{4}\\-\\d{2}\\-\\d{2}\\-\\d{6}$`);

    /**
     * Confirm a name of snapshot is Elephant Backup's snapshot or not.
     * @param {string} snapshotName a snapshot name
     * @returns {boolean} true if Elephant Backup, otherwise false.
     */
    static isCorrectedName(snapshotName) {
        const isCorrected = Snapshot.#snapshotRegExp.test(snapshotName);
        return isCorrected;
    }

    /**
     * @type {string} The time used in taking a snapshot.
     */
    static #now = Snapshot.#getNowDate();

    static #getNowDate() {
        // Get the current time in ISO format.
        const date = new Date();

        const fy = date.getFullYear().toString().padStart(4, '0');
        const mo = (date.getMonth() + 1).toString().padStart(2,'0');
        const d = date.getDate().toString().padStart(2,'0');
        const h = date.getHours().toString().padStart(2,'0');
        const mi = date.getMinutes().toString().padStart(2,'0');
        const s = date.getSeconds().toString().padStart(2,'0');

        const localDate = `${fy}-${mo}-${d}-${h}${mi}${s}`;
        return localDate;
    }
}
