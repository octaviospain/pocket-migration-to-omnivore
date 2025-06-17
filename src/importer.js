import { Omnivore, isOmnivoreError, OmnivoreErrorCode } from '@omnivore-app/api';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { Logger } from './logger.js';
import { CsvParser } from './csv-parser.js';
import { TagProcessor } from './tag-processor.js';

export class PocketToOmnivoreImporter {
    constructor(apiKey, baseUrl, options = {}) {
        this.omnivore = new Omnivore({
            apiKey,
            baseUrl,
            timeoutMs: 30000 // 30 second timeout
        });
        this.labelCache = new Map(); // Cache created labels to avoid duplicates
        this.logger = Logger;
        this.options = {
            unreadUntagged: options.unreadUntagged || false,
            delayBetweenRequests: options.delayBetweenRequests || 200,
            urlTimeout: options.urlTimeout || 10000 // 10 second timeout for URL checks
        };
    }

    /**
     * Check if a URL is still alive and accessible
     * @param {string} url - URL to check
     * @returns {Promise<Object>} Object with isAlive boolean and status info
     */
    async checkUrlAlive(url) {
        return new Promise(resolve => {
            // eslint-disable-next-line no-undef
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const options = {
                method: 'HEAD',
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                timeout: this.options.urlTimeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PocketToOmnivore/1.0)'
                }
            };

            const req = httpModule.request(options, res => {
                const statusCode = res.statusCode;

                // Consider 2xx and 3xx as alive
                if (statusCode >= 200 && statusCode < 400) {
                    resolve({ isAlive: true, statusCode, reason: 'OK' });
                } else {
                    resolve({
                        isAlive: false,
                        statusCode,
                        reason: `HTTP ${statusCode}`
                    });
                }
            });

            req.on('error', err => {
                resolve({
                    isAlive: false,
                    statusCode: null,
                    reason: err.code || err.message
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    isAlive: false,
                    statusCode: null,
                    reason: 'Timeout'
                });
            });

            req.end();
        });
    }

    /**
     * Delay execution for specified milliseconds
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Determine if an article should be archived based on options and article state
     * @param {string} status - Article status from Pocket
     * @param {boolean} hasTags - Whether the article has tags
     * @returns {boolean} Whether to archive the article
     */
    shouldArchiveArticle(status, hasTags) {
        if (status !== 'archive') {
            return false;
        }

        if (this.options.unreadUntagged) {
            // Only archive if article has tags
            return hasTags;
        } else {
            // Default behavior: archive all articles marked as archived in Pocket
            return true;
        }
    }

    /**
     * Prepare base save parameters for Omnivore API
     * @param {string} url - Article URL
     * @returns {Object} Base save parameters
     */
    prepareSaveParams(url) {
        return {
            url,
            clientRequestId: uuidv4(),
            source: 'api',
            timezone: 'UTC',
            locale: 'en-US'
        };
    }

    /**
     * Add labels to save parameters if available
     * @param {Object} saveParams - Save parameters object to modify
     * @param {Array} labels - Array of label objects
     */
    addLabelsToParams(saveParams, labels) {
        if (labels.length > 0) {
            saveParams.labels = labels;
        }
    }

    /**
     * Add archive state to save parameters if needed
     * @param {Object} saveParams - Save parameters object to modify
     * @param {boolean} shouldArchive - Whether to archive the article
     */
    addArchiveStateToParams(saveParams, shouldArchive) {
        if (shouldArchive) {
            saveParams.state = 'ARCHIVED';
        }
    }

    /**
     * Add timestamps to save parameters if available
     * @param {Object} saveParams - Save parameters object to modify
     * @param {string} timeAdded - Unix timestamp string
     */
    addTimestampsToParams(saveParams, timeAdded) {
        if (timeAdded && !isNaN(parseInt(timeAdded, 10))) {
            const timestamp = new Date(parseInt(timeAdded, 10) * 1000).toISOString();
            saveParams.savedAt = timestamp;
            saveParams.publishedAt = timestamp;
        }
    }

    /**
     * Build complete save parameters for the article
     * @param {string} url - Article URL
     * @param {Array} labels - Array of label objects
     * @param {boolean} shouldArchive - Whether to archive the article
     * @param {string} timeAdded - Unix timestamp string
     * @returns {Object} Complete save parameters
     */
    buildSaveParams(url, labels, shouldArchive, timeAdded) {
        const saveParams = this.prepareSaveParams(url);

        this.addLabelsToParams(saveParams, labels);
        this.addArchiveStateToParams(saveParams, shouldArchive);
        this.addTimestampsToParams(saveParams, timeAdded);

        return saveParams;
    }

    /**
     * Save article to Omnivore using the API
     * @param {Object} saveParams - Complete save parameters
     * @returns {Object} API response
     */
    async saveArticleToOmnivore(saveParams) {
        try {
            return await this.omnivore.items.saveByUrl(saveParams);
        } catch (error) {
            throw this.handleOmnivoreError(error);
        }
    }

    /**
     * Handle and format Omnivore API errors
     * @param {Error} error - The error from Omnivore API
     * @returns {Error} Formatted error
     */
    handleOmnivoreError(error) {
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
            return new Error(errorMessage);
        } else {
            return new Error(`Unexpected error - ${error.message}`);
        }
    }

    /**
     * Create processing result object
     * @param {Object} apiResult - Result from Omnivore API
     * @param {string} title - Article title
     * @param {string} url - Article URL
     * @param {Array} labels - Array of label objects
     * @param {Object} saveParams - Save parameters used
     * @param {string} status - Original Pocket status
     * @returns {Object} Processing result
     */
    createProcessingResult(apiResult, title, url, labels, saveParams, status) {
        return {
            success: true,
            id: apiResult.id,
            title,
            url,
            hasLabels: labels.length > 0,
            isArchived: saveParams.state === 'ARCHIVED',
            wasArchivedInPocket: status === 'archive'
        };
    }

    /**
     * Create processing result object for skipped URLs
     * @param {string} title - Article title
     * @param {string} url - Article URL
     * @param {string} reason - Reason for skipping
     * @returns {Object} Processing result for skipped item
     */
    createSkippedResult(title, url, reason) {
        return {
            success: false,
            skipped: true,
            title,
            url,
            reason,
            hasLabels: false,
            isArchived: false,
            wasArchivedInPocket: false
        };
    }

    /**
     * Process a single row from the CSV
     * @param {number} rowNum - Row number for error reporting
     * @param {Object} rowData - Raw row data from CSV
     * @returns {Object} Processing result
     */
    async processRow(rowNum, rowData) {
        try {
            // Validate and clean row data
            const { title, url, timeAdded, tags, status } = CsvParser.validateRow(rowNum, rowData);

            // Check if URL is still alive
            const urlCheck = await this.checkUrlAlive(url);
            if (!urlCheck.isAlive) {
                this.logger.warning(`Row ${rowNum}: Skipping dead URL (${urlCheck.reason}): ${url}`);
                return this.createSkippedResult(title, url, `Dead URL: ${urlCheck.reason}`);
            }

            // Process tags and determine archiving behavior
            const labels = TagProcessor.processTags(tags);
            const hasTags = labels.length > 0;
            const shouldArchive = this.shouldArchiveArticle(status, hasTags);

            // Build save parameters
            const saveParams = this.buildSaveParams(url, labels, shouldArchive, timeAdded);

            // Save the item to Omnivore
            const apiResult = await this.saveArticleToOmnivore(saveParams);

            // Return processing result
            return this.createProcessingResult(apiResult, title, url, labels, saveParams, status);
        } catch (error) {
            // Add row context to error message
            const contextualError = new Error(`Row ${rowNum}: ${error.message}`);
            contextualError.originalError = error;
            throw contextualError;
        }
    }

    /**
     * Validate and parse CSV file
     * @param {string} csvFilePath - Path to CSV file
     * @returns {Array} Parsed CSV rows
     */
    async validateAndParseCsv(csvFilePath) {
        this.logger.info('Starting import from CSV...');

        // Check if file exists
        if (!fs.existsSync(csvFilePath)) {
            throw new Error(`CSV file not found: ${csvFilePath}`);
        }

        let rows;
        try {
            rows = await CsvParser.parseCsvFile(csvFilePath);
        } catch (error) {
            throw new Error(`Error parsing CSV file: ${error.message}`);
        }

        this.logger.info(`Found ${rows.length} rows in CSV file`);
        return rows;
    }

    /**
     * Initialize import statistics
     * @returns {Object} Statistics object
     */
    initializeStats() {
        return {
            total: 0,
            successful: 0,
            skipped: 0,
            tagged: 0,
            archived: 0,
            skippedArchive: 0
        };
    }

    /**
     * Update statistics based on processing result
     * @param {Object} stats - Current statistics
     * @param {Object} result - Processing result
     */
    updateStats(stats, result) {
        stats.total++;
        if (result.skipped) {
            stats.skipped++;
        } else if (result.success) {
            stats.successful++;
            if (result.hasLabels) stats.tagged++;
            if (result.isArchived) stats.archived++;
            if (result.wasArchivedInPocket && !result.isArchived) stats.skippedArchive++;
        }
    }

    /**
     * Handle processing error for a row
     * @param {Error} error - The error that occurred
     * @param {number} rowNum - Row number
     * @param {Object} row - Row data
     * @param {Object} stats - Current statistics
     */
    handleProcessingError(error, rowNum, row, stats) {
        // Clear the progress line and show the error
        this.logger.finalizeProgress();
        this.logger.error(`IMPORT STOPPED: ${error.message}`);
        this.logger.error(`Failed at row ${rowNum}:`);
        this.logger.error(`  Title: "${(row.title || '').trim()}"`);
        this.logger.error(`  URL: "${(row.url || '').trim()}"`);
        this.logger.error(`  Tags: "${(row.tags || '').trim()}"`);
        this.logger.error(`  Status: "${(row.status || '').trim()}"`);
        this.logger.error(
            `\nProgress before failure: ${stats.successful}/${stats.total - 1} articles imported successfully`
        );

        // Re-throw to stop the import
        throw error;
    }

    /**
     * Process all rows from CSV
     * @param {Array} rows - CSV rows to process
     * @returns {Object} Import statistics
     */
    async processAllRows(rows) {
        const stats = this.initializeStats();

        for (const [index, row] of rows.entries()) {
            const rowNum = index + 1;

            try {
                // Update progress bar with current article title
                const currentTitle = (row.title || '').trim() || 'Untitled';
                this.logger.updateProgress(stats.total, rows.length, `Processing: ${currentTitle}`);

                const result = await this.processRow(rowNum, row);
                this.updateStats(stats, result);
            } catch (error) {
                this.handleProcessingError(error, rowNum, row, stats);
            }

            // Add delay between requests to avoid rate limiting
            if (index < rows.length - 1) {
                await this.delay(this.options.delayBetweenRequests);
            }
        }

        return stats;
    }

    /**
     * Finalize import process
     * @param {Array} rows - Processed rows
     * @param {Object} stats - Final statistics
     */
    finalizeImport(rows, stats) {
        // Final progress update
        this.logger.updateProgress(rows.length, rows.length, 'Import completed!');
        this.logger.finalizeProgress();
        this.logFinalStatistics(stats);
    }

    /**
     * Import articles from CSV file
     * @param {string} csvFilePath - Path to CSV file
     * @returns {Object} Import statistics
     */
    async importFromCsv(csvFilePath) {
        const rows = await this.validateAndParseCsv(csvFilePath);

        this.logger.info('Starting import process...\n');

        const stats = await this.processAllRows(rows);

        this.finalizeImport(rows, stats);

        return stats;
    }

    /**
     * Log final import statistics
     * @param {Object} stats - Import statistics
     */
    logFinalStatistics(stats) {
        this.logger.success(`Import completed successfully!`);
        this.logger.success(`📊 Final Statistics:`);
        this.logger.success(`  ✅ Total articles processed: ${stats.successful}/${stats.total}`);

        if (stats.skipped > 0) {
            this.logger.success(`  ⏭️  Articles skipped (dead URLs): ${stats.skipped}`);
        }

        this.logger.success(`  🏷️  Articles with tags: ${stats.tagged}`);
        this.logger.success(`  📦 Articles archived: ${stats.archived}`);
        this.logger.success(`  📖 Articles kept unread: ${stats.successful - stats.archived}`);

        if (this.options.unreadUntagged && stats.skippedArchive > 0) {
            this.logger.success(`  ⏭️  Archived→Unread (untagged): ${stats.skippedArchive}`);
        }
    }
}
