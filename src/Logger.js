/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import util from "node:util";
import stream from "node:stream"; // NOSONAR
import console from 'node:console';

export class LogLevel{
    static DEBUG = ['DBG', 0];
    static INFO = ['INF', 1];
    static PRINT = ['PRT', 2];
    static WARN = ['WRN', 3];
    static ERROR = ['ERR', 4];
}

/**
 * class Logger.
 * Print and store messages.
 */
export class Logger {

    static #defaultInstance = new Logger();

    #logLevel = LogLevel.PRINT;

    /** @type{Console|null} */
    #secondConsole = null;

    /**
     * Get the default Logger instance.
     * @return {Logger} the default Logger.
     */
    static getLogger() {
        return Logger.#defaultInstance;
    }

    /**
     * Constructor
     */
    constructor() {
        // nothing to do.
    }

    /**
     * Add a console with a writable.
     * @param {stream.Writable} writable
     */
    addConsole(writable) {
        this.#secondConsole = new console.Console(writable);
    }

    /**
     * Set a log level.
     * @param {(string|number)[]} level
     */
    setLogLevel(level) {
        this.#logLevel = level;
    }

    /**
     * Print a log message.
     * @param {(string|number)[]} level
     * @param {any} format
     * @param {any[]} params
     */
    #printLog(level, format, ...params) {
        if (level[1] < this.#logLevel[1]) {
            return;
        }

        const message = util.format(format, ...params);

        // Get the current time in ISO format.
        const date = new Date();
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        const dateIsoString = date.toISOString();
        const dateString = dateIsoString.substring(0, dateIsoString.length -1);

        // Get the caller calling the public methods of this instance.
        const caller = getCaller();

        const shortDate = dateString.split('T');
        const consolePrefix = 
                `[${shortDate[1]}][${level[0]}]`;
        console.log(`${consolePrefix} ${message}`);

        const writablePrefix = 
                `[${dateString}]${caller.filename}:${caller.lineno}[${level[0]}]`;
        this.#secondConsole?.log(`${writablePrefix} ${message}`);
    }

    /**
     * Prints an terminal message.
     * @param {any} format
     * @param {any[]} params
     */
    print(format, ...params) {
        this.#printLog(LogLevel.PRINT, format, ...params);
    }

    /**
     * Prints an warning message.
     * @param {any} format
     * @param {any[]} params
     */
    warn(format, ...params) {
        this.#printLog(LogLevel.WARN, format, ...params);
    }

    /**
     * Prints an error message.
     * @param {any} format
     * @param {any[]} params
     */
    error(format, ...params) {
        this.#printLog(LogLevel.ERROR, format, ...params);
    }

    /**
     * Prints an warning message.
     * @param {any} format
     * @param {any[]} params
     */
    info(format, ...params) {
        this.#printLog(LogLevel.INFO, format, ...params);
    }

    /**
     * Prints an debug message.
     * @param {any} format
     * @param {any[]} params
     */
    debug(format, ...params) {
        this.#printLog(LogLevel.DEBUG, format, ...params);
    }

    /**
     * Terminate this application with message.
     * @param {any} format
     * @param {any[]} params
     */
    exit(format, ...params) {
        this.#printLog(LogLevel.ERROR, format, ...params);
        process.exit();
    }
}

/**
 * Get a caller function from the stack.
 * @returns {{filename: string, lineno: number, functionName: string}} the caller function information.
 */
function getCaller() {
    // Backup the original function.
    const original = Error.prepareStackTrace;

    /**
     * @type {NodeJS.CallSite[]}
     */
    let stack = [];
    Error.prepareStackTrace = (_, stackTrace) => {
        stack = stackTrace;
        return stackTrace;
    }

    const err = new Error;
    // Capture the current stack trace by calling captureStackTrace and attaching err.stack.
    Error.captureStackTrace(err, getCaller);

    err.stack; // NOSONAR

    Error.prepareStackTrace = original;

    const lastFrame = stack[2];
    const filename =  getFilename(lastFrame.getFileName() || "No filename");
    const lineno = lastFrame.getLineNumber() || -1;
    const functionName = lastFrame.getFunctionName() || "Noname function";

    const result =
            { filename, lineno, functionName };
    return result;
}

/**
 * Get a caller function from the stack.
 * @param {string} path an absolute URL.
 * @returns {string} the caller function information.
 */
function getFilename(path) {
    const pathElements = path.split('/');
    const filename = pathElements[pathElements.length -1];
    return filename;
}



