import { Omnivore, isOmnivoreError, OmnivoreErrorCode } from '@omnivore-app/api';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
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
            delayBetweenRequests: options.delayBetweenRequests || 200
        };
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
     * Process a single row from the CSV
     * @param {number} rowNum - Row number for error reporting
     * @param {Object} rowData - Raw row data from CSV
     * @returns {Object} Processing result
     */
    async processRow(rowNum, rowData) {
        // Validate and clean row data
        const { title, url, timeAdded, tags, status } = CsvParser.validateRow(rowNum, rowData);

        try {
            // Process tags
            const labels = TagProcessor.processTags(tags);
            const hasTags = labels.length > 0;

            // Prepare save parameters
            const saveParams = {
                url,
                clientRequestId: uuidv4(),
                source: 'api',
                timezone: 'UTC',
                locale: 'en-US'
            };

            // Add labels if any
            if (labels.length > 0) {
                saveParams.labels = labels;
            }

            // Determine archiving behavior
            const shouldArchive = this.shouldArchiveArticle(status, hasTags);
            if (shouldArchive) {
                saveParams.state = 'ARCHIVED';
            }

            // Add timestamps if available
            if (timeAdded && !isNaN(parseInt(timeAdded, 10))) {
                const timestamp = new Date(parseInt(timeAdded, 10) * 1000).toISOString();
                saveParams.savedAt = timestamp;
                saveParams.publishedAt = timestamp;
            }

            // Save the item
            const result = await this.omnivore.items.saveByUrl(saveParams);

            return {
                success: true,
                id: result.id,
                title,
                url,
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
        if (result.success) {
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
        this.logger.success(`  🏷️  Articles with tags: ${stats.tagged}`);
        this.logger.success(`  📦 Articles archived: ${stats.archived}`);
        this.logger.success(`  📖 Articles kept unread: ${stats.successful - stats.archived}`);

        if (this.options.unreadUntagged && stats.skippedArchive > 0) {
            this.logger.success(`  ⏭️  Archived→Unread (untagged): ${stats.skippedArchive}`);
        }
    }
}
