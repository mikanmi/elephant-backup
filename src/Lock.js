/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
"use strict";

import EventEmitter from 'node:events';

import { Logger } from './Logger.js';

const logger = Logger.getLogger();

export class Lock {
    /** @type {boolean} */
    #acquired;
    /** @type {EventEmitter} */
    #eventEmitter;

    constructor() {
        this.#acquired = false;
        this.#eventEmitter = new EventEmitter();
    }

    /**
     * Acquire the lock.
     * Wait on the released event if anyone has acquired it already.
     */
    acquire() {
        // logger.debug(`acquire: ${this.#acquired}`);

        const resolver = (/** @type any */resolve) =>  {
            const notifier = () => {
                if (!this.#acquired) {
                    this.#acquired = true;
                    this.#eventEmitter.removeListener('released', notifier);
                    resolve('dummy');
                }
            };

            if (this.#acquired) {
                this.#eventEmitter.on('released', notifier);
            }
            else {
                this.#acquired = true;
                resolve('dummy');
            }
        }

        const promise = new Promise(resolver);

        // logger.debug(`acquire: ${this.#acquired}`);
        return promise;
    }

    /**
     * Release the lock gotten on the acquire method after waiting in 'waitTime.'
     * @param {number} waitTime
     */
    release(waitTime = 0) {
        setTimeout(() => {
            this.#acquired = false;
            this.#eventEmitter.emit('released');
        },
        waitTime);
    }
}
