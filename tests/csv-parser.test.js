import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CsvParser } from '../src/csv-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CsvParser', () => {
    const testDataDir = path.join(__dirname, 'test-data');
    const validCsvPath = path.join(testDataDir, 'valid-test.csv');
    const invalidCsvPath = path.join(testDataDir, 'invalid-test.csv');
    const nonExistentPath = path.join(testDataDir, 'non-existent.csv');

    beforeEach(() => {
        // Create test data directory
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }

        // Create valid test CSV
        const validCsvContent = `title,url,tags,time_added,status
"Test Article 1","https://example.com/1","tech|programming","1609459200","unread"
"Test Article 2","https://example.com/2","science|research","1609545600","archive"
"Test Article 3","https://example.com/3","","1609632000","unread"
"Test Article 4","https://example.com/4","design|ui|ux","1609718400","archive"`;

        fs.writeFileSync(validCsvPath, validCsvContent);

        // Create invalid test CSV (malformed)
        const invalidCsvContent = `title,url,tags,time_added,status
"Test Article 1","https://example.com/1","tech|programming","1609459200","unread"
"Test Article 2",,"science|research","1609545600","archive"
"Test Article 3","not-a-url","","1609632000","unread"`;

        fs.writeFileSync(invalidCsvPath, invalidCsvContent);
    });

    afterEach(() => {
        // Clean up test files
        if (fs.existsSync(validCsvPath)) {
            fs.unlinkSync(validCsvPath);
        }
        if (fs.existsSync(invalidCsvPath)) {
            fs.unlinkSync(invalidCsvPath);
        }
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });

    describe('parseCsvFile', () => {
        it('should parse valid CSV file correctly', async () => {
            const rows = await CsvParser.parseCsvFile(validCsvPath);

            assert.strictEqual(rows.length, 4);

            // Check first row
            assert.strictEqual(rows[0].title, 'Test Article 1');
            assert.strictEqual(rows[0].url, 'https://example.com/1');
            assert.strictEqual(rows[0].tags, 'tech|programming');
            assert.strictEqual(rows[0].time_added, '1609459200');
            assert.strictEqual(rows[0].status, 'unread');

            // Check second row
            assert.strictEqual(rows[1].title, 'Test Article 2');
            assert.strictEqual(rows[1].status, 'archive');

            // Check row with empty tags
            assert.strictEqual(rows[2].tags, '');
        });

        it('should throw error for non-existent file', async () => {
            await assert.rejects(() => CsvParser.parseCsvFile(nonExistentPath), {
                message: /File reading error/
            });
        });

        it('should handle empty CSV file', async () => {
            const emptyCsvPath = path.join(testDataDir, 'empty.csv');
            fs.writeFileSync(emptyCsvPath, '');

            const rows = await CsvParser.parseCsvFile(emptyCsvPath);
            assert.strictEqual(rows.length, 0);

            fs.unlinkSync(emptyCsvPath);
        });
    });

    describe('validateRow', () => {
        it('should validate and clean valid row data', () => {
            const rowData = {
                title: '  Test Article  ',
                url: 'https://example.com',
                tags: 'tech|programming',
                time_added: '1609459200',
                status: 'unread'
            };

            const result = CsvParser.validateRow(1, rowData);

            assert.strictEqual(result.title, 'Test Article');
            assert.strictEqual(result.url, 'https://example.com');
            assert.strictEqual(result.tags, 'tech|programming');
            assert.strictEqual(result.timeAdded, '1609459200');
            assert.strictEqual(result.status, 'unread');
        });

        it('should handle missing optional fields', () => {
            const rowData = {
                url: 'https://example.com'
            };

            const result = CsvParser.validateRow(1, rowData);

            assert.strictEqual(result.title, '');
            assert.strictEqual(result.url, 'https://example.com');
            assert.strictEqual(result.tags, '');
            assert.strictEqual(result.timeAdded, '');
            assert.strictEqual(result.status, '');
        });

        it('should throw error for empty URL', () => {
            const rowData = {
                title: 'Test Article',
                url: '',
                tags: 'tech'
            };

            assert.throws(() => CsvParser.validateRow(1, rowData), {
                message: 'Row 1: Empty URL found'
            });
        });

        it('should throw error for missing URL field', () => {
            const rowData = {
                title: 'Test Article',
                tags: 'tech'
            };

            assert.throws(() => CsvParser.validateRow(1, rowData), {
                message: 'Row 1: Empty URL found'
            });
        });

        it('should throw error for invalid URL format', () => {
            const rowData = {
                title: 'Test Article',
                url: 'not-a-valid-url',
                tags: 'tech'
            };

            assert.throws(() => CsvParser.validateRow(2, rowData), {
                message: 'Row 2: Invalid URL format: not-a-valid-url Error: Invalid URL'
            });
        });

        it('should accept various valid URL formats', () => {
            const validUrls = [
                'https://example.com',
                'http://example.com',
                'https://subdomain.example.com/path',
                'https://example.com:8080/path?query=value#fragment'
            ];

            validUrls.forEach((url, index) => {
                const rowData = { url };
                const result = CsvParser.validateRow(index + 1, rowData);
                assert.strictEqual(result.url, url);
            });
        });
    });
});
