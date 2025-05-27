#!/usr/bin/env node

/**
 * Pocket to Omnivore Import Script using Official Node.js Client
 *
 * Usage: node import-pocket-to-omnivore.js [options] <csv_file_path>
 *
 * Options:
 *   --unread_untagged    Don't archive articles without tags, even if marked as archived in Pocket
 *
 * Environment Variables:
 * - OMNIVORE_API_KEY: Your Omnivore API key (required)
 * - OMNIVORE_BASE_URL: Base URL for your Omnivore instance (optional, defaults to https://api-prod.omnivore.app)
 */

import { Omnivore, isOmnivoreError, OmnivoreErrorCode } from '@omnivore-app/api';
import path from 'path';
import { fileURLToPath } from 'url';
import fs, { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { v4 as uuidv4 } from 'uuid';
import readline from 'readline';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DELAY_BETWEEN_REQUESTS = 200; // 200ms delay
const API_KEY = process.env.OMNIVORE_API_KEY;
const BASE_URL = process.env.OMNIVORE_BASE_URL;

// Colors for logging
const Colors = {
    RED: '\x1b[0;31m',
    GREEN: '\x1b[0;32m',
    YELLOW: '\x1b[1;33m',
    BLUE: '\x1b[0;34m',
    NC: '\x1b[0m' // No Color
};

class Logger {
    static info(message) {
        console.log(`${Colors.BLUE}[INFO]${Colors.NC} ${message}`);
    }

    static success(message) {
        console.log(`${Colors.GREEN}[SUCCESS]${Colors.NC} ${message}`);
    }

    static error(message) {
        console.log(`${Colors.RED}[ERROR]${Colors.NC} ${message}`);
    }

    static warning(message) {
        console.log(`${Colors.YELLOW}[WARNING]${Colors.NC} ${message}`);
    }

    static clearLine() {
        if (process.stdout.isTTY) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
        }
    }

    static updateProgress(current, total, currentTitle = '') {
        if (!process.stdout.isTTY) {
            // Fallback for non-TTY environments
            if (current % 5 === 0 || current === total) {
                console.log(`Progress: ${current}/${total} articles processed`);
            }
            return;
        }

        this.clearLine();
        const percentage = Math.round((current / total) * 100);
        const progressBar = this.createProgressBar(current, total, 30);
        const truncatedTitle = currentTitle.length > 50 ?
            currentTitle.substring(0, 47) + '...' :
            currentTitle;

        process.stdout.write(
            `${Colors.BLUE}[PROGRESS]${Colors.NC} ${progressBar} ${percentage}% (${current}/${total}) ${truncatedTitle}`
        );

        if (current === total) {
            process.stdout.write('\n');
        }
    }

    static createProgressBar(current, total, width = 30) {
        const filledWidth = Math.round((current / total) * width);
        const emptyWidth = width - filledWidth;
        const filled = '█'.repeat(filledWidth);
        const empty = '░'.repeat(emptyWidth);
        return `${Colors.GREEN}${filled}${Colors.NC}${empty}`;
    }

    static finalizeProgress() {
        if (process.stdout.isTTY) {
            process.stdout.write('\n');
        }
    }
}

class PocketToOmnivoreImporter {
    constructor(apiKey, baseUrl, options = {}) {
        this.omnivore = new Omnivore({
            apiKey: apiKey,
            baseUrl: baseUrl,
            timeoutMs: 30000 // 30 second timeout
        });
        this.labelCache = new Map(); // Cache created labels to avoid duplicates
        this.logger = Logger;
        this.options = {
            unreadUntagged: options.unreadUntagged || false
        };
    }

    /**
     * Delay execution for specified milliseconds
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Parse CSV file and return rows
     */
    async parseCsvFile(csvFilePath) {
        return new Promise((resolve, reject) => {
            const rows = [];
            const parser = parse({
                columns: true,
                skip_empty_lines: true,
                trim: true
            });

            parser.on('readable', function() {
                let record;
                while (record = parser.read()) {
                    rows.push(record);
                }
            });

            parser.on('error', function(err) {
                reject(err);
            });

            parser.on('end', function() {
                resolve(rows);
            });

            createReadStream(csvFilePath).pipe(parser);
        });
    }

    /**
     * Process a single row from the CSV
     */
    async processRow(rowNum, rowData) {
        const title = (rowData.title || '').trim();
        const url = (rowData.url || '').trim();
        const timeAdded = (rowData.time_added || '').trim();
        const tags = (rowData.tags || '').trim();
        const status = (rowData.status || '').trim();

        // Validate URL
        if (!url) {
            throw new Error(`Row ${rowNum}: Empty URL found`);
        }

        try {
            // Parse tags (skip if empty or looks like timestamp)
            const labels = [];
            const hasTags = tags && !tags.match(/^\d+$/);

            if (hasTags) {
                const tagList = tags.split('|').map(tag => tag.trim()).filter(tag => tag);

                for (const tag of tagList) {
                    if (tag) {
                        labels.push({
                            name: tag,
                            color: '#EF8C43', // Default orange color
                            description: ''
                        });
                    }
                }
            }

            // Prepare save parameters
            const saveParams = {
                url: url,
                clientRequestId: uuidv4(),
                source: 'api',
                timezone: 'UTC',
                locale: 'en-US'
            };

            // Add labels if any
            if (labels.length > 0) {
                saveParams.labels = labels;
            }

            // Determine archiving behavior based on options and article state
            let shouldArchive = false;
            if (status === 'archive') {
                if (this.options.unreadUntagged) {
                    // Only archive if article has tags (your specific use case)
                    shouldArchive = hasTags && labels.length > 0;
                } else {
                    // Default behavior: archive all articles marked as archived in Pocket
                    shouldArchive = true;
                }
            }

            if (shouldArchive) {
                saveParams.state = 'ARCHIVED';
            }

            // Add timestamps if available
            if (timeAdded && !isNaN(parseInt(timeAdded))) {
                const timestamp = new Date(parseInt(timeAdded) * 1000).toISOString();
                saveParams.savedAt = timestamp;
                saveParams.publishedAt = timestamp;
            }

            // Save the item
            const result = await this.omnivore.items.saveByUrl(saveParams);

            return {
                success: true,
                id: result.id,
                title: title,
                url: url,
                hasLabels: labels.length > 0,
                isArchived: saveParams.state === 'ARCHIVED',
                wasArchivedInPocket: status === 'archive'
            };

        } catch (error) {
            if (isOmnivoreError(error)) {
                let errorMessage;
                switch (error.code) {
                    case OmnivoreErrorCode.GraphQLError:
                        errorMessage = `GraphQL error: ${error.message}`;
                        break;
                    case OmnivoreErrorCode.NetworkError:
                        errorMessage = `Network error: ${error.message}`;
                        break;
                    default:
                        errorMessage = `Omnivore error: ${error.message}`;
                }
                throw new Error(`Row ${rowNum}: ${errorMessage}`);
            } else {
                throw new Error(`Row ${rowNum}: Unexpected error - ${error.message}`);
            }
        }
    }

    /**
     * Import articles from CSV file
     */
    async importFromCsv(csvFilePath) {
        this.logger.info('Starting import from CSV...');

        // Check if file exists
        if (!fs.existsSync(csvFilePath)) {
            throw new Error(`CSV file not found: ${csvFilePath}`);
        }

        let rows;
        try {
            rows = await this.parseCsvFile(csvFilePath);
        } catch (error) {
            throw new Error(`Error parsing CSV file: ${error.message}`);
        }

        this.logger.info(`Found ${rows.length} rows in CSV file`);
        this.logger.info('Starting import process...\n');

        let successCount = 0;
        let totalCount = 0;
        let archivedCount = 0;
        let taggedCount = 0;
        let skippedArchiveCount = 0; // Articles that were archived in Pocket but kept unread

        for (const [index, row] of rows.entries()) {
            totalCount++;
            const rowNum = index + 1;

            try {
                // Update progress bar with current article title
                const currentTitle = (row.title || '').trim() || 'Untitled';
                this.logger.updateProgress(totalCount - 1, rows.length, `Processing: ${currentTitle}`);

                const result = await this.processRow(rowNum, row);

                if (result.success) {
                    successCount++;
                    if (result.hasLabels) taggedCount++;
                    if (result.isArchived) archivedCount++;
                    if (result.wasArchivedInPocket && !result.isArchived) skippedArchiveCount++;
                } else {
                    // This shouldn't happen with the new error handling, but just in case
                    throw new Error(`Failed to process row ${rowNum}`);
                }

            } catch (error) {
                // Clear the progress line and show the error
                this.logger.finalizeProgress();
                this.logger.error(`IMPORT STOPPED: ${error.message}`);
                this.logger.error(`Failed at row ${rowNum}:`);
                this.logger.error(`  Title: "${(row.title || '').trim()}"`);
                this.logger.error(`  URL: "${(row.url || '').trim()}"`);
                this.logger.error(`  Tags: "${(row.tags || '').trim()}"`);
                this.logger.error(`  Status: "${(row.status || '').trim()}"`);
                this.logger.error(`\nProgress before failure: ${successCount}/${totalCount - 1} articles imported successfully`);

                // Re-throw to stop the import
                throw error;
            }

            // Add delay between requests to avoid rate limiting
            if (index < rows.length - 1) {
                await this.delay(DELAY_BETWEEN_REQUESTS);
            }
        }

        // Final progress update
        this.logger.updateProgress(rows.length, rows.length, 'Import completed!');
        this.logger.finalizeProgress();

        this.logger.success(`Import completed successfully!`);
        this.logger.success(`📊 Final Statistics:`);
        this.logger.success(`  ✅ Total articles processed: ${successCount}/${totalCount}`);
        this.logger.success(`  🏷️  Articles with tags: ${taggedCount}`);
        this.logger.success(`  📦 Articles archived: ${archivedCount}`);
        this.logger.success(`  📖 Articles kept unread: ${successCount - archivedCount}`);

        if (this.options.unreadUntagged && skippedArchiveCount > 0) {
            this.logger.success(`  ⏭️  Archived→Unread (untagged): ${skippedArchiveCount}`);
        }

        return {
            total: totalCount,
            successful: successCount,
            tagged: taggedCount,
            archived: archivedCount,
            skippedArchive: skippedArchiveCount
        };
    }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        unreadUntagged: false,
        csvFile: null
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--unread_untagged') {
            options.unreadUntagged = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node import-pocket-to-omnivore.js [options] <csv_file_path>');
            console.log('');
            console.log('Options:');
            console.log('  --unread_untagged    Don\'t archive articles without tags, even if marked as archived in Pocket');
            console.log('  --help, -h           Show this help message');
            console.log('');
            console.log('Environment Variables:');
            console.log('  OMNIVORE_API_KEY     Your Omnivore API key (required)');
            console.log('  OMNIVORE_BASE_URL    Base URL for your Omnivore instance (required)');
            process.exit(0);
        } else if (!arg.startsWith('--')) {
            // This should be the CSV file path
            if (!options.csvFile) {
                options.csvFile = arg;
            } else {
                console.error('Error: Multiple CSV files specified');
                process.exit(1);
            }
        } else {
            console.error(`Error: Unknown option ${arg}`);
            process.exit(1);
        }
    }

    if (!options.csvFile) {
        console.error('Error: CSV file path is required');
        console.error('Usage: node import-pocket-to-omnivore.js [options] <csv_file_path>');
        process.exit(1);
    }

    return options;
}

/**
 * Main function
 */
async function main() {
    // Parse command line arguments
    const options = parseArgs();

    // Check for required environment variables
    if (!API_KEY) {
        Logger.error('OMNIVORE_API_KEY environment variable is required');
        Logger.error('Set it with: export OMNIVORE_API_KEY="your-api-key-here"');
        process.exit(1);
    }

    Logger.info('Starting Pocket to Omnivore import script');
    Logger.info(`Omnivore Base URL: ${BASE_URL}`);
    Logger.info(`CSV File: ${options.csvFile}`);

    if (options.unreadUntagged) {
        Logger.info('🏷️  Option: --unread_untagged enabled (articles without tags will stay unread)');
    }

    // Create importer and run
    const importer = new PocketToOmnivoreImporter(API_KEY, BASE_URL, {
        unreadUntagged: options.unreadUntagged
    });

    try {
        const result = await importer.importFromCsv(options.csvFile);
        Logger.success('Script completed successfully!');
        process.exit(0);
    } catch (error) {
        Logger.error(`Import failed: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        Logger.error(`Fatal error: ${error.message}`);
        process.exit(1);
    });
}