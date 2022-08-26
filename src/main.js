#!/usr/bin/env node
/**
 * Copyright (c) 2022 Patineboot.
 * All rights reserved.
 * 
 * Elephant Backup is licensed under BSD 2-Clause License.
 */
"use strict"

import { ElephantBackup } from './ElephantBackup.js';

// This is the entry point of this application.
const application = new ElephantBackup();
await application.start();
