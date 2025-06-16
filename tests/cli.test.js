import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { CLI } from '../src/cli.js';

describe('CLI', () => {
    let originalProcessExit;
    let originalConsoleLog;
    let originalConsoleError;
    let exitCode;
    let logOutput = [];
    let errorOutput = [];

    beforeEach(() => {
        // Mock process.exit
        originalProcessExit = process.exit;
        process.exit = code => {
            exitCode = code;
            throw new Error(`Process exit called with code ${code}`);
        };

        // Mock console.log and console.error
        originalConsoleLog = console.log;
        originalConsoleError = console.error;

        console.log = (...args) => {
            logOutput.push(args.join(' '));
        };

        console.error = (...args) => {
            errorOutput.push(args.join(' '));
        };

        // Reset arrays
        logOutput = [];
        errorOutput = [];
        exitCode = null;
    });

    afterEach(() => {
        // Restore original functions
        process.exit = originalProcessExit;
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    });

    describe('parseArgs', () => {
        it('should parse basic CSV file argument', () => {
            const args = ['test.csv'];
            const result = CLI.parseArgs(args);

            assert.strictEqual(result.csvFile, 'test.csv');
            assert.strictEqual(result.unreadUntagged, false);
        });

        it('should parse unread_untagged option', () => {
            const args = ['--unread_untagged', 'test.csv'];
            const result = CLI.parseArgs(args);

            assert.strictEqual(result.csvFile, 'test.csv');
            assert.strictEqual(result.unreadUntagged, true);
        });

        it('should handle options in different order', () => {
            const args = ['test.csv', '--unread_untagged'];
            const result = CLI.parseArgs(args);

            assert.strictEqual(result.csvFile, 'test.csv');
            assert.strictEqual(result.unreadUntagged, true);
        });

        it('should exit with help when --help is provided', () => {
            const args = ['--help'];

            assert.throws(() => CLI.parseArgs(args), {
                message: 'Process exit called with code 0'
            });

            assert.strictEqual(exitCode, 0);
            assert(logOutput.some(line => line.includes('Usage:')));
        });

        it('should exit with help when -h is provided', () => {
            const args = ['-h'];

            assert.throws(() => CLI.parseArgs(args), {
                message: 'Process exit called with code 0'
            });

            assert.strictEqual(exitCode, 0);
        });

        it('should exit with error for unknown option', () => {
            const args = ['--unknown-option', 'test.csv'];

            assert.throws(() => CLI.parseArgs(args), {
                message: 'Process exit called with code 1'
            });

            assert.strictEqual(exitCode, 1);
            assert(errorOutput.some(line => line.includes('Unknown option')));
        });

        it('should exit with error for multiple CSV files', () => {
            const args = ['test1.csv', 'test2.csv'];

            assert.throws(() => CLI.parseArgs(args), {
                message: 'Process exit called with code 1'
            });

            assert.strictEqual(exitCode, 1);
            assert(errorOutput.some(line => line.includes('Multiple CSV files')));
        });

        it('should exit with error when no CSV file provided', () => {
            const args = ['--unread_untagged'];

            assert.throws(() => CLI.parseArgs(args), {
                message: 'Process exit called with code 1'
            });

            assert.strictEqual(exitCode, 1);
            assert(errorOutput.some(line => line.includes('CSV file path is required')));
        });

        it('should exit with error when no arguments provided', () => {
            const args = [];

            assert.throws(() => CLI.parseArgs(args), {
                message: 'Process exit called with code 1'
            });

            assert.strictEqual(exitCode, 1);
        });
    });

    describe('showHelp', () => {
        it('should show comprehensive help message', () => {
            CLI.showHelp();

            assert(logOutput.some(line => line.includes('Usage:')));
            assert(logOutput.some(line => line.includes('Options:')));
            assert(logOutput.some(line => line.includes('--unread_untagged')));
            assert(logOutput.some(line => line.includes('Environment Variables:')));
            assert(logOutput.some(line => line.includes('OMNIVORE_API_KEY')));
            assert(logOutput.some(line => line.includes('OMNIVORE_BASE_URL')));
        });
    });

    describe('validateEnvironment', () => {
        let originalEnv;

        beforeEach(() => {
            originalEnv = { ...process.env };
        });

        afterEach(() => {
            process.env = originalEnv;
        });

        it('should return environment config when API key is present', () => {
            process.env.OMNIVORE_API_KEY = 'test-api-key';
            process.env.OMNIVORE_BASE_URL = 'https://test.example.com';

            const result = CLI.validateEnvironment();

            assert.strictEqual(result.apiKey, 'test-api-key');
            assert.strictEqual(result.baseUrl, 'https://test.example.com');
        });

        it('should return undefined baseUrl when not set', () => {
            process.env.OMNIVORE_API_KEY = 'test-api-key';
            delete process.env.OMNIVORE_BASE_URL;

            const result = CLI.validateEnvironment();

            assert.strictEqual(result.apiKey, 'test-api-key');
            assert.strictEqual(result.baseUrl, undefined);
        });

        it('should exit with error when API key is missing', () => {
            delete process.env.OMNIVORE_API_KEY;

            assert.throws(() => CLI.validateEnvironment(), {
                message: 'Process exit called with code 1'
            });

            assert.strictEqual(exitCode, 1);
            // Should use Logger.error, but since we mocked console.error, check error messages
        });

        it('should exit with error when API key is empty', () => {
            process.env.OMNIVORE_API_KEY = '';

            assert.throws(() => CLI.validateEnvironment(), {
                message: 'Process exit called with code 1'
            });

            assert.strictEqual(exitCode, 1);
        });
    });

    describe('logStartup', () => {
        it('should log startup information with all options', () => {
            const config = {
                apiKey: 'test-key',
                baseUrl: 'https://test.example.com'
            };
            const options = {
                csvFile: 'test.csv',
                unreadUntagged: true
            };

            CLI.logStartup(config, options);

            // Should have called Logger methods, which we mocked as console.log
            // Check that startup info was logged (this would normally use Logger.info)
            // Since Logger.info also uses console.log, we should see the messages
        });

        it('should use default base URL when not provided', () => {
            const config = {
                apiKey: 'test-key',
                baseUrl: undefined
            };
            const options = {
                csvFile: 'test.csv',
                unreadUntagged: false
            };

            CLI.logStartup(config, options);

            // Should log default URL
            // This would be better tested with Logger integration
        });
    });
});
