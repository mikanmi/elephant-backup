/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
'use strict'

import * as fsPromises from 'node:fs/promises';
import * as fs from 'node:fs';
import util from "node:util";
import console from 'node:console';

import { Configure } from "./Configure.js";

class LogType {
    #tag;
    #level;

    /**
     * log type class.
     * @param {string} tag 
     * @param {number} level 
     */
    constructor(tag, level) {
        this.#tag = tag;
        this.#level = level;
    }
    get TAG() {
        return this.#tag;
    }
    get LEVEL() {
        return this.#level;
    }
}

export class LogLevel {
    static DEVL =  new LogType('DEV', 0);
    static DEBUG = new LogType('DBG', 1);
    static INFO =  new LogType('INF', 2);
    static PRINT = new LogType('PRT', 3);
    static WARN =  new LogType('WRN', 4);
    static ERROR = new LogType('ERR', 5);
}

class LogWriter {

    constructor() {
        // nothing to do.
    }

    /**
     * Prepare this LogWriter.
     */
    async prepare() {
        // nothing to do.
    }

    /**
     * Write the message to the log file.
     * 
     * @param {string} line a line to write to the log file.
     */
    // @ts-ignore
    writeLine(line) { // NOSONAR
        // nothing to do.
    }
}

class ConsoleLogWriter extends LogWriter {
    /**
     * Prepare this LogWriter.
     */
    async prepare() {
        // nothing to do.
    }

    /**
     * Write the message to the log file.
     * 
     * @param {string} line a line to write to the log file.
     */
     writeLine(line) {
        console.log(line);
    }
}

class FileLogWriter extends LogWriter {

    /** @type {number} */
    #fileHandle = -1;

    /**
     * Constructor. Open the log file.
     */
    constructor() {
        super();
    }

    /**
     * Prepare this LogWriter.
     */
    async prepare() {
        const filePath = Configure.LOG_FILE_PATH;
        const size = Configure.LOG_FILE_SIZE;

        if (fs.existsSync(filePath)) {
            await this.#truncate(filePath, size);
        }
        else {
            // create the empty log file with the permission to read and write on every user.
            const fh = await fsPromises.open(filePath, 'w');
            await fh.close();
            await fsPromises.chmod(filePath, 0o666);
        }

        this.#fileHandle = fs.openSync(Configure.LOG_FILE_PATH, 'as');
    }

    /**
     * Write the message to the log file.
     * 
     * @param {string} line a line to write to the log file.
     */
    writeLine(line) {
        const message = `${line}\n`;
        fs.writeSync(this.#fileHandle, message);
    }

    /**
     * Truncate the head of a file.
     * 
     * @param {string} filePath the path of the file.
     * @param {number} size the new size of the file.
     */
    async #truncate(filePath, size) {

        if (!fs.existsSync(filePath)) {
            // return if the file dose not exist.
            return;
        }

        let truncatingSize = 0;
        let fileHandle;
        try {
            fileHandle = await fsPromises.open(filePath, 'r+');

            // calculate the starting position to read the file.
            const stat = await fileHandle.stat();
            const findStart = stat.size - size;
            if (findStart <= 0) {
                // return immediately if the size variable is shorter than the file size.
                return;
            }

            // Find the first record after truncating the log file.
            const movePosition = await this.#findFirstRecord(fileHandle, findStart);
            if (movePosition >= 0) {
                truncatingSize = stat.size - movePosition;
            }

            const buffer = new Uint8Array(16 * 1024); // 16K bytes
            let readingPosition = movePosition;
            let writingPosition = 0;
            for (;;) { // NOSONAR
                const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, readingPosition);
                if (bytesRead == 0) {
                    // complete moving the logs from the read-position to the top.
                    break;
                }
                readingPosition += bytesRead;

                const { bytesWritten } = await fileHandle.write(buffer, 0, bytesRead, writingPosition);
                if (bytesWritten != bytesRead) {
                    throw new Error('Writing to the log file is failed while truncating it.');
                }
                writingPosition += bytesWritten;
            }
        }
        finally{
            await fileHandle?.close();
        }
        await fsPromises.truncate(filePath, truncatingSize);
    }

    /**
     * Find the new starting record on the log file.
     * @param {fsPromises.FileHandle} fileHandle
     * @param {number} startPosition the position to start to find the new starting record.
     * @returns the position of the new starting record, a negative value if not found.
     */
    async #findFirstRecord(fileHandle, startPosition) {
        const buffer = new Uint8Array(16 * 1024); // 16K bytes

        const utf8Encode = new TextEncoder();
        const sentence = utf8Encode.encode(Configure.LOG_START_SENTENCE);

        let readingPosition = startPosition;
        let found = -1;
        READ_LOOP: for (;;) { // NOSONAR
            const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, readingPosition);
            if (bytesRead == 0) {
                // found the end of the file instead of the new starting record.
                break;
            }

            for (let index = 0; index < buffer.length - sentence.length; index++) {
                if (buffer[index] == sentence[0]) {
                    const candidateView = new Uint8Array(buffer, index, sentence.length);
                    if (this.#equalsArray(candidateView, sentence)) {
                        found = index;
                        break READ_LOOP;
                    }
                }
            }
            readingPosition += bytesRead;
        }
        return found;
    }

    /**
     * Confirm array1 equals arrays. 
     * @param {Uint8Array} array1 
     * @param {Uint8Array} array2
     * @returns {boolean} true if array1 equals array2, false if not equal.
     */
    #equalsArray(array1, array2) {
        if (array1.length != array2.length) {
            return false;
        }

        let result = true;
        for (let index = 0; index < array1.length; index++) {
            if (array1[index] != array2[index]) {
                result = false;
                break;
            }
        }
        return result;
    }
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

    /** @type{LogType} The Log Level. */
    #logLevel = LogLevel.PRINT;

    /** @type {LogWriter[]} */
    #logWriter = [];

    /**
     * Constructor
     */
    constructor() {
        // nothing to do.
    }

    /**
     * Set a log level.
     * @param {LogType} level
     */
    setLogLevel(level) {
        this.#logLevel = level;
    }

    /**
     * Print a log message.
     * @param {LogType} level
     * @param {any} format
     * @param {any[]} params
     */
    #printLog(level, format, ...params) {
        if (level.LEVEL < this.#logLevel.LEVEL) {
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

        // Make the short and long prefix.
        const shortDate = dateString.split('T');
        const shortPrefix = 
                `[${shortDate[1]}][${level.TAG}]`;
        const longPrefix = 
                `[${dateString}]${caller.filename}:${caller.lineno}[${level.TAG}]`;

        // Print the log message.
        const prefix = this.#logLevel === LogLevel.DEVL ? longPrefix : shortPrefix;
        this.#writeLine(`${prefix} ${message}`)
    }

    /**
     * Prepare the console and log writers.
     */
    async #prepare() {
        for (const writer of this.#logWriter) {
            await writer.prepare();
        }
    }


    /**
     * Write a message to the console and log writers.
     * @param {string} line 
     */
    #writeLine(line) {
        for (const writer of this.#logWriter) {
            writer.writeLine(line);
        }
    }

    /**
     * Start logging, and Prints the first log message on terminal.
     */
     async startLog() {
        this.#logWriter.push(new ConsoleLogWriter());
        this.#logWriter.push(new FileLogWriter());

        await this.#prepare();

        const startMessage = Configure.LOG_START_SENTENCE;
        this.#writeLine(startMessage);
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



