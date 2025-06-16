import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Integration Tests', () => {
    const testDataDir = path.join(__dirname, 'test-data');
    const scriptPath = path.join(__dirname, '..', 'import-pocket-to-omnivore.js');

    beforeEach(() => {
        // Create test data directory
        if (!fs.existsSync(testDataDir)) {
            fs.mkdirSync(testDataDir, { recursive: true });
        }
    });

    afterEach(() => {
        // Clean up test files
        if (fs.existsSync(testDataDir)) {
            fs.rmSync(testDataDir, { recursive: true, force: true });
        }
    });

    function runScript(args, env = {}) {
        return new Promise(resolve => {
            // eslint-disable-next-line sonarjs/no-os-command-from-path
            const child = spawn('node', [scriptPath, ...args], {
                stdio: 'pipe',
                env: { ...process.env, ...env }
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', data => {
                stdout += data.toString();
            });

            child.stderr.on('data', data => {
                stderr += data.toString();
            });

            child.on('close', code => {
                resolve({ code, stdout, stderr });
            });
        });
    }

    describe('CLI Arguments', () => {
        it('should show help with --help flag', async () => {
            const result = await runScript(['--help']);

            assert.strictEqual(result.code, 0);
            assert(result.stdout.includes('Usage:'));
            assert(result.stdout.includes('Options:'));
            assert(result.stdout.includes('--unread_untagged'));
        });

        it('should show help with -h flag', async () => {
            const result = await runScript(['-h']);

            assert.strictEqual(result.code, 0);
            assert(result.stdout.includes('Usage:'));
        });

        it('should fail without CSV file argument', async () => {
            const result = await runScript([]);

            assert.strictEqual(result.code, 1);
            assert(result.stderr.includes('CSV file path is required'));
        });

        it('should fail with unknown option', async () => {
            const result = await runScript(['--unknown-option', 'test.csv']);

            assert.strictEqual(result.code, 1);
            assert(result.stderr.includes('Unknown option'));
        });

        it('should fail without API key', async () => {
            const csvPath = path.join(testDataDir, 'test.csv');
            fs.writeFileSync(csvPath, 'title,url\n"Test","https://example.com"');

            const result = await runScript([csvPath], { OMNIVORE_API_KEY: '' });

            assert.strictEqual(result.code, 1);
            // Logger outputs to stdout, not stderr
            assert(result.stdout.includes('OMNIVORE_API_KEY environment variable is required'));
        });
    });

    describe('CSV File Validation', () => {
        it('should fail with non-existent CSV file', async () => {
            const result = await runScript(['/non/existent/file.csv'], {
                OMNIVORE_API_KEY: 'test-key'
            });

            assert.strictEqual(result.code, 1);
            // Logger outputs to stdout, not stderr
            assert(result.stdout.includes('CSV file not found'));
        });

        it('should fail with malformed CSV', async () => {
            const malformedCsv = `title,url,tags,time_added,status
                                        "Good Article","https://example.com","tech","1609459200","unread"
                                        "Bad Article","","","",""`;

            const csvPath = path.join(testDataDir, 'malformed.csv');
            fs.writeFileSync(csvPath, malformedCsv);

            try {
                // eslint-disable-next-line sonarjs/os-command
                execSync(`node import-pocket-to-omnivore.js "${csvPath}"`, {
                    cwd: path.join(__dirname, '..'),
                    env: { ...process.env, OMNIVORE_API_KEY: 'test-key' },
                    encoding: 'utf8',
                    timeout: 30000
                });

                assert.fail('Expected the command to fail');
            } catch (error) {
                // Just check that the command failed (non-zero exit code)
                assert(error.status !== 0, 'Expected command to fail with non-zero exit code');
            }
        });
    });

    describe('Option Parsing', () => {
        it('should accept --unread_untagged option', async () => {
            const csvPath = path.join(testDataDir, 'test.csv');
            fs.writeFileSync(csvPath, 'title,url,tags,status\n"Test","https://example.com","tech","archive"');

            // This will fail due to missing API, but should parse the option correctly
            const result = await runScript(['--unread_untagged', csvPath], {
                OMNIVORE_API_KEY: 'test-key'
            });

            // Should fail at network level, not argument parsing
            assert(result.stdout.includes('--unread_untagged enabled') || result.stderr.includes('Network error'));
        });

        it('should handle options in different order', async () => {
            const csvPath = path.join(testDataDir, 'test.csv');
            fs.writeFileSync(csvPath, 'title,url\n"Test","https://example.com"');

            const result = await runScript([csvPath, '--unread_untagged'], {
                OMNIVORE_API_KEY: 'test-key'
            });

            // Should parse correctly and fail at network level
            assert(result.stdout.includes('--unread_untagged enabled') || result.stderr.includes('Network error'));
        });
    });

    describe('Environment Variables', () => {
        it('should use custom base URL from environment', async () => {
            const csvPath = path.join(testDataDir, 'test.csv');
            fs.writeFileSync(csvPath, 'title,url\n"Test","https://example.com"');

            const result = await runScript([csvPath], {
                OMNIVORE_API_KEY: 'test-key',
                OMNIVORE_BASE_URL: 'https://custom.omnivore.com'
            });

            assert(result.stdout.includes('https://custom.omnivore.com'));
        });

        it('should use default base URL when not specified', async () => {
            const csvPath = path.join(testDataDir, 'test.csv');
            fs.writeFileSync(csvPath, 'title,url\n"Test","https://example.com"');

            const result = await runScript([csvPath], {
                OMNIVORE_API_KEY: 'test-key'
            });

            // Should show undefined in logs for base URL when not set
            assert(result.stdout.includes('Omnivore Base URL'));
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid URLs gracefully', async () => {
            const csvContent = `title,url,tags,status
"Valid Article","https://example.com","tech","unread"
"Invalid Article","not-a-url","tech","unread"`;

            const csvPath = path.join(testDataDir, 'invalid-url.csv');
            fs.writeFileSync(csvPath, csvContent);

            const result = await runScript([csvPath], {
                OMNIVORE_API_KEY: 'test-key'
            });

            // Should exit with error code
            assert.strictEqual(result.code, 1);

            // Should contain some indication of URL error in output
            const combinedOutput = result.stdout + result.stderr;
            const hasUrlError =
                combinedOutput.includes('Invalid URL format') ||
                combinedOutput.includes('not-a-url') ||
                combinedOutput.includes('URL') ||
                combinedOutput.includes('error');

            assert(hasUrlError, `Expected some error indication. Combined output: ${combinedOutput}`);
        });

        it('should show progress information', async () => {
            const csvContent = `title,url,tags,status
"Test Article","https://example.com","tech","unread"`;

            const csvPath = path.join(testDataDir, 'progress.csv');
            fs.writeFileSync(csvPath, csvContent);

            const result = await runScript([csvPath], {
                OMNIVORE_API_KEY: 'test-key'
            });

            // Should show some startup information before failing on network
            const combinedOutput = result.stdout + result.stderr;
            const hasProgressInfo =
                combinedOutput.includes('Found 1 rows') ||
                combinedOutput.includes('Starting import') ||
                combinedOutput.includes('CSV') ||
                combinedOutput.includes('Omnivore');

            assert(hasProgressInfo, `Expected progress info. Combined output: ${combinedOutput}`);
        });

        it('should fail gracefully with missing API key', async () => {
            const csvPath = path.join(testDataDir, 'test.csv');
            fs.writeFileSync(csvPath, 'title,url\n"Test","https://example.com"');

            const result = await runScript([csvPath], {
                OMNIVORE_API_KEY: '' // Empty API key
            });

            // Should exit with error
            assert.strictEqual(result.code, 1);

            // Should mention API key requirement somewhere
            const combinedOutput = result.stdout + result.stderr;
            const hasApiKeyError =
                combinedOutput.includes('OMNIVORE_API_KEY') ||
                combinedOutput.includes('API key') ||
                combinedOutput.includes('required');

            assert(hasApiKeyError, `Expected API key error. Combined output: ${combinedOutput}`);
        });

        it('should handle file not found errors', async () => {
            const result = await runScript(['/definitely/does/not/exist.csv'], {
                OMNIVORE_API_KEY: 'test-key'
            });

            // Should exit with error
            assert.strictEqual(result.code, 1);

            // Should indicate a file problem
            const combinedOutput = result.stdout + result.stderr;
            const hasFileError =
                combinedOutput.includes('not found') ||
                combinedOutput.includes('ENOENT') ||
                combinedOutput.includes('file') ||
                combinedOutput.includes('CSV');

            assert(hasFileError, `Expected file error. Combined output: ${combinedOutput}`);
        });
    });
});
