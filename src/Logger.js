/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import * as fsPromises from 'node:fs/promises';
import util from "node:util";
import console from 'node:console';

import { Configure } from "./Configure.js";

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
 * Logger class is designed with the Singleton design.
 */
export class Logger {

    static #defaultInstance = new Logger();

    /**
     * Get the default Logger instance.
     * @return {Logger} the default Logger.
     */
    static getLogger() {
        return Logger.#defaultInstance;
    }

    /** @type{(string|number)[]} The Log Level. */
    #logLevel = LogLevel.PRINT;

    /** @type{LogFile}. */
    #logFile;

    /** @type{Console|null}. */
    #fileConsole = null;


    /**
     * Constructor
     */
    constructor() {
        this.#logFile = new LogFile();
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
        this.#fileConsole?.log(`${writablePrefix} ${message}`);
    }

    /**
     * Start logging, and Prints the first log message on terminal.
     */
     async startLog() {
        this.#logFile.truncate();

        this.#fileConsole = await this.#logFile.getConsole();

        const startMessage = Configure.LOG_START_SENTENCE;
        console.log(startMessage);
        this.#fileConsole.log(startMessage);
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

class LogFile {

    /**
     * Get the Console associate with the log file.
     * 
     * @returns {Promise<Console>} the Console.
     */
    async getConsole() {
        const handle = await fsPromises.open(Configure.LOG_FILE_PATH, 'as');
        const writeStream = handle.createWriteStream();

        return new console.Console(writeStream);
    }

    /**
     * Truncate the head of file.
     */
     async truncate() {
        const filePath = Configure.LOG_FILE_PATH;
        const size = Configure.LOG_FILE_SIZE;

        let fileHandle;
        try {
            fileHandle = await fsPromises.open(filePath, 'r+');
        }
        catch {
            // return if the file dose not exist.
            return;
        }

        // calculate the starting position to read the file.
        const stat = await fileHandle.stat()
        const startPositionOnRead = stat.size - size;
        if (startPositionOnRead <= 0) {
            // return immediately if the size variable is shorter than the file size.
            return;
        }

        let moving = false;
        const buffer = new Uint8Array(16 * 1024); // 16K bytes
        let readingPosition = startPositionOnRead;
        let writingPosition = 0;
        // NOSONAR
        for (;;) {
            const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, readingPosition);
            if (bytesRead == 0) {
                // complete moving the logs from the read-position to the top.
                break;
            }
            if (!moving) {
                const position = this.#findSingleLog(buffer, bytesRead);
                if (position) {
                    // start moving the finding logs to the top.
                    readingPosition += position;
                    moving = true;
                    continue;
                }
            }
            readingPosition += bytesRead;

            if (moving) {
                const { bytesWritten } = await fileHandle.write(buffer, 0, bytesRead, writingPosition);
                if (bytesWritten != bytesRead) {
                    throw new Error('Writing to the log file is failed while truncating it.');
                }
                writingPosition += bytesWritten;
            }
        }

        await fsPromises.truncate(filePath, size);
    }

    /**
     * Find the first single log on the multiple log records.
     * 
     * @param {Uint8Array} chunk a raw array of a part of the multiple log records.
     * @param {number} chunkSize the size of the raw array. 
     * @returns {number|undefined} found: an negative, zero, or positive value of start-position if found, otherwise undefined.
     */
    #findSingleLog(chunk, chunkSize) {
        let found = undefined;

        const utf8Encode = new TextEncoder();
        const sentence = utf8Encode.encode(Configure.LOG_START_SENTENCE);

        let finding = this.#finding;

        for (let index = 0; index < chunkSize; index++) {
            const character = chunk[index];
            if (character == sentence[finding]) {
                finding++;
                if (finding == sentence.length) {
                    found = index - sentence.length - 1;
                    break;
                }
            }
            else {
                finding = 0;
            }
        }
        this.#finding = finding;
        return found;
    }

    /** @type {number} finding: positive value if under considering, need more following chunks. otherwise zero. */
    #finding = 0;
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



