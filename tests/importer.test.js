import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PocketToOmnivoreImporter } from '../src/importer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the Omnivore API
class MockOmnivore {
    constructor(config) {
        this.config = config;
        this.items = {
            saveByUrl: async params => {
                // Simulate API behavior
                if (params.url === 'https://error.example.com') {
                    throw new Error('Network error');
                }
                if (params.url === 'https://graphql-error.example.com') {
                    const error = new Error('GraphQL error: Invalid input');
                    error.code = 'GraphQLError';
                    throw error;
                }
                return {
                    // eslint-disable-next-line sonarjs/pseudo-random
                    id: `mock-id-${Math.random()}`,
                    url: params.url,
                    title: 'Mock Title',
                    state: params.state || 'ACTIVE'
                };
            }
        };
    }
}

describe('PocketToOmnivoreImporter', () => {
    let importer;
    let testDataDir;
    let originalConsoleLog;
    let originalStdoutWrite;
    let logOutput = [];

    beforeEach(() => {
        // Create test data directory
        testDataDir = path.join(__dirname, 'test-data');
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }

        // Mock console outputs
        originalConsoleLog = console.log;
        originalStdoutWrite = process.stdout.write;

        console.log = (...args) => {
            logOutput.push(args.join(' '));
        };

        process.stdout.write = () => true;
        process.stdout.isTTY = false; // Disable TTY for testing

        // Create importer with mock API
        importer = new PocketToOmnivoreImporter('mock-api-key', 'https://mock.api.com', {
            delayBetweenRequests: 0 // No delay for testing
        });

        // Replace the real Omnivore client with mock
        importer.omnivore = new MockOmnivore({
            apiKey: 'mock-api-key',
            baseUrl: 'https://mock.api.com'
        });

        logOutput = [];
    });

    afterEach(() => {
        // Restore original functions
        console.log = originalConsoleLog;
        process.stdout.write = originalStdoutWrite;

        // Clean up test files
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            const imp = new PocketToOmnivoreImporter('api-key', 'https://api.com');

            assert.strictEqual(imp.options.unreadUntagged, false);
            assert.strictEqual(imp.options.delayBetweenRequests, 200);
        });

        it('should initialize with custom options', () => {
            const imp = new PocketToOmnivoreImporter('api-key', 'https://api.com', {
                unreadUntagged: true,
                delayBetweenRequests: 100
            });

            assert.strictEqual(imp.options.unreadUntagged, true);
            assert.strictEqual(imp.options.delayBetweenRequests, 100);
        });
    });

    describe('delay', () => {
        it('should delay execution', async () => {
            const start = Date.now();
            await importer.delay(50);
            const end = Date.now();

            assert(end - start >= 45); // Allow some variance
        });
    });

    describe('shouldArchiveArticle', () => {
        it('should not archive unread articles', () => {
            assert.strictEqual(importer.shouldArchiveArticle('unread', true), false);
            assert.strictEqual(importer.shouldArchiveArticle('unread', false), false);
        });

        it('should archive archived articles by default', () => {
            assert.strictEqual(importer.shouldArchiveArticle('archive', true), true);
            assert.strictEqual(importer.shouldArchiveArticle('archive', false), true);
        });

        it('should only archive tagged articles when unreadUntagged is true', () => {
            const importerWithOption = new PocketToOmnivoreImporter('api-key', 'url', {
                unreadUntagged: true
            });

            assert.strictEqual(importerWithOption.shouldArchiveArticle('archive', true), true);
            assert.strictEqual(importerWithOption.shouldArchiveArticle('archive', false), false);
        });
    });

    describe('processRow', () => {
        it('should process a valid row successfully', async () => {
            const rowData = {
                title: 'Test Article',
                url: 'https://example.com',
                tags: 'tech|programming',
                time_added: '1609459200',
                status: 'unread'
            };

            const result = await importer.processRow(1, rowData);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.title, 'Test Article');
            assert.strictEqual(result.url, 'https://example.com');
            assert.strictEqual(result.hasLabels, true);
            assert.strictEqual(result.isArchived, false);
            assert.strictEqual(result.wasArchivedInPocket, false);
        });

        it('should process archived article', async () => {
            const rowData = {
                title: 'Archived Article',
                url: 'https://example.com/archived',
                tags: 'tech',
                time_added: '1609459200',
                status: 'archive'
            };

            const result = await importer.processRow(1, rowData);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.isArchived, true);
            assert.strictEqual(result.wasArchivedInPocket, true);
        });

        it('should process article without tags', async () => {
            const rowData = {
                title: 'No Tags Article',
                url: 'https://example.com/notags',
                tags: '',
                time_added: '1609459200',
                status: 'unread'
            };

            const result = await importer.processRow(1, rowData);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.hasLabels, false);
        });

        it('should handle unreadUntagged option correctly', async () => {
            const importerWithOption = new PocketToOmnivoreImporter('api-key', 'url', {
                unreadUntagged: true
            });
            importerWithOption.omnivore = new MockOmnivore({});

            const rowData = {
                title: 'Archived No Tags',
                url: 'https://example.com/archived-notags',
                tags: '',
                status: 'archive'
            };

            const result = await importerWithOption.processRow(1, rowData);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.isArchived, false); // Should not be archived due to no tags
            assert.strictEqual(result.wasArchivedInPocket, true);
        });

        it('should process article with timestamps', async () => {
            const rowData = {
                title: 'Timestamped Article',
                url: 'https://example.com/timestamped',
                tags: 'tech',
                time_added: '1609459200',
                status: 'unread'
            };

            const result = await importer.processRow(1, rowData);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.title, 'Timestamped Article');
        });

        it('should handle article without timestamp', async () => {
            const rowData = {
                title: 'No Timestamp Article',
                url: 'https://example.com/notimestamp',
                tags: 'tech',
                time_added: '',
                status: 'unread'
            };

            const result = await importer.processRow(1, rowData);

            assert.strictEqual(result.success, true);
        });

        it('should throw error for invalid URL', async () => {
            const rowData = {
                title: 'Invalid URL',
                url: 'not-a-url',
                tags: 'tech',
                status: 'unread'
            };

            await assert.rejects(() => importer.processRow(1, rowData), {
                message: /Row 1: Invalid URL format/
            });
        });

        it('should throw error for empty URL', async () => {
            const rowData = {
                title: 'Empty URL',
                url: '',
                tags: 'tech',
                status: 'unread'
            };

            await assert.rejects(() => importer.processRow(1, rowData), {
                message: /Row 1: Empty URL found/
            });
        });

        it('should handle API network errors', async () => {
            const rowData = {
                title: 'Error Article',
                url: 'https://error.example.com',
                tags: 'tech',
                status: 'unread'
            };

            await assert.rejects(() => importer.processRow(1, rowData), {
                message: /Row 1: Unexpected error - Network error/
            });
        });

        it('should handle GraphQL errors', async () => {
            const rowData = {
                title: 'GraphQL Error Article',
                url: 'https://graphql-error.example.com',
                tags: 'tech',
                status: 'unread'
            };

            await assert.rejects(() => importer.processRow(1, rowData), {
                message: /Row 1: Unexpected error - GraphQL error/
            });
        });
    });

    describe('importFromCsv', () => {
        it('should import valid CSV successfully', async () => {
            const csvContent = `title,url,tags,time_added,status
"Article 1","https://example.com/1","tech|programming","1609459200","unread"
"Article 2","https://example.com/2","science","1609545600","archive"`;

            const csvPath = path.join(testDataDir, 'test.csv');
            fs.writeFileSync(csvPath, csvContent);

            const result = await importer.importFromCsv(csvPath);

            assert.strictEqual(result.total, 2);
            assert.strictEqual(result.successful, 2);
            assert.strictEqual(result.tagged, 2);
            assert.strictEqual(result.archived, 1);
            assert.strictEqual(result.skippedArchive, 0);
        });

        it('should handle CSV with mixed content', async () => {
            const csvContent = `title,url,tags,time_added,status
"Tagged Unread","https://example.com/1","tech|programming","1609459200","unread"
"Untagged Archived","https://example.com/2","","1609545600","archive"
"Tagged Archived","https://example.com/3","science","1609632000","archive"`;

            const csvPath = path.join(testDataDir, 'mixed.csv');
            fs.writeFileSync(csvPath, csvContent);

            const result = await importer.importFromCsv(csvPath);

            assert.strictEqual(result.total, 3);
            assert.strictEqual(result.successful, 3);
            assert.strictEqual(result.tagged, 2);
            assert.strictEqual(result.archived, 2); // Both archived articles should be archived
        });

        it('should handle unreadUntagged option', async () => {
            const importerWithOption = new PocketToOmnivoreImporter('api-key', 'url', {
                unreadUntagged: true
            });
            importerWithOption.omnivore = new MockOmnivore({});

            const csvContent = `title,url,tags,time_added,status
"Tagged Archived","https://example.com/1","tech","1609459200","archive"
"Untagged Archived","https://example.com/2","","1609545600","archive"`;

            const csvPath = path.join(testDataDir, 'unread-untagged.csv');
            fs.writeFileSync(csvPath, csvContent);

            const result = await importerWithOption.importFromCsv(csvPath);

            assert.strictEqual(result.total, 2);
            assert.strictEqual(result.successful, 2);
            assert.strictEqual(result.tagged, 1);
            assert.strictEqual(result.archived, 1); // Only tagged article should be archived
            assert.strictEqual(result.skippedArchive, 1); // Untagged archived article kept unread
        });

        it('should throw error for non-existent file', async () => {
            await assert.rejects(() => importer.importFromCsv('/non/existent/file.csv'), {
                message: /CSV file not found/
            });
        });

        it('should handle empty CSV with headers only', async () => {
            const csvContent = `title,url,tags,time_added,status`;

            const csvPath = path.join(testDataDir, 'headers-only.csv');
            fs.writeFileSync(csvPath, csvContent);

            const result = await importer.importFromCsv(csvPath);

            assert.strictEqual(result.total, 0);
            assert.strictEqual(result.successful, 0);
            assert.strictEqual(result.tagged, 0);
            assert.strictEqual(result.archived, 0);
        });

        it('should stop on first error and provide detailed information', async () => {
            const csvContent = `title,url,tags,time_added,status
"Good Article","https://example.com/good","tech","1609459200","unread"
"Bad Article","invalid-url","tech","1609545600","unread"
"Never Processed","https://example.com/never","tech","1609632000","unread"`;

            const csvPath = path.join(testDataDir, 'with-error.csv');
            fs.writeFileSync(csvPath, csvContent);

            await assert.rejects(() => importer.importFromCsv(csvPath), {
                message: /Row 2: Invalid URL format/
            });
        });

        it('should handle single row CSV', async () => {
            const csvContent = `title,url,tags,time_added,status
"Single Article","https://example.com/single","tech","1609459200","unread"`;

            const csvPath = path.join(testDataDir, 'single.csv');
            fs.writeFileSync(csvPath, csvContent);

            const result = await importer.importFromCsv(csvPath);

            assert.strictEqual(result.total, 1);
            assert.strictEqual(result.successful, 1);
            assert.strictEqual(result.tagged, 1);
            assert.strictEqual(result.archived, 0);
        });

        it('should handle small CSV files efficiently', async () => {
            // Generate a smaller CSV for testing (reduce from 50 to 5 for faster tests)
            let csvContent = 'title,url,tags,time_added,status\n';
            for (let i = 1; i <= 5; i++) {
                csvContent += `"Article ${i}","https://example.com/${i}","tech","1609459200","unread"\n`;
            }

            const csvPath = path.join(testDataDir, 'small.csv');
            fs.writeFileSync(csvPath, csvContent);

            const result = await importer.importFromCsv(csvPath);

            assert.strictEqual(result.total, 5);
            assert.strictEqual(result.successful, 5);
            assert.strictEqual(result.tagged, 5);
            assert.strictEqual(result.archived, 0);
        });
    });

    describe('logFinalStatistics', () => {
        it('should log comprehensive statistics', () => {
            const stats = {
                total: 10,
                successful: 9,
                tagged: 7,
                archived: 5,
                skippedArchive: 2
            };

            importer.logFinalStatistics(stats);

            // Check that statistics were logged
            assert(logOutput.some(line => line.includes('Import completed successfully')));
            assert(logOutput.some(line => line.includes('9/10')));
            assert(logOutput.some(line => line.includes('Articles with tags: 7')));
            assert(logOutput.some(line => line.includes('Articles archived: 5')));
        });

        it('should show skipped archive count when unreadUntagged is enabled', () => {
            const importerWithOption = new PocketToOmnivoreImporter('api-key', 'url', {
                unreadUntagged: true
            });

            const stats = {
                total: 5,
                successful: 5,
                tagged: 3,
                archived: 2,
                skippedArchive: 1
            };

            importerWithOption.logFinalStatistics(stats);

            assert(logOutput.some(line => line.includes('Archived→Unread (untagged): 1')));
        });

        it('should not show skipped archive count when unreadUntagged is disabled', () => {
            const stats = {
                total: 5,
                successful: 5,
                tagged: 3,
                archived: 3,
                skippedArchive: 0
            };

            importer.logFinalStatistics(stats);

            assert(!logOutput.some(line => line.includes('Archived→Unread')));
        });

        it('should handle zero statistics', () => {
            const stats = {
                total: 0,
                successful: 0,
                tagged: 0,
                archived: 0,
                skippedArchive: 0
            };

            importer.logFinalStatistics(stats);

            assert(logOutput.some(line => line.includes('Import completed successfully')));
            assert(logOutput.some(line => line.includes('0/0')));
        });
    });
});
