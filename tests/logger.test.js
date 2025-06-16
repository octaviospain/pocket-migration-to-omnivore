import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Logger } from '../src/logger.js';

describe('Logger', () => {
    let originalConsoleLog;
    let originalStdoutWrite;
    let originalIsTTY;
    let logOutput = [];
    let writeOutput = [];

    beforeEach(() => {
        // Mock console.log
        originalConsoleLog = console.log;
        console.log = (...args) => {
            logOutput.push(args.join(' '));
        };

        // Mock process.stdout.write
        originalStdoutWrite = process.stdout.write;
        process.stdout.write = data => {
            writeOutput.push(data);
            return true;
        };

        // Mock process.stdout.isTTY
        originalIsTTY = process.stdout.isTTY;
        process.stdout.isTTY = true;

        // Clear output arrays
        logOutput = [];
        writeOutput = [];
    });

    afterEach(() => {
        // Restore original functions
        console.log = originalConsoleLog;
        process.stdout.write = originalStdoutWrite;
        process.stdout.isTTY = originalIsTTY;
    });

    describe('Basic logging methods', () => {
        it('should log info messages with blue color', () => {
            Logger.info('Test info message');
            assert.strictEqual(logOutput.length, 1);
            assert(logOutput[0].includes('[INFO]'));
            assert(logOutput[0].includes('Test info message'));
        });

        it('should log success messages with green color', () => {
            Logger.success('Test success message');
            assert.strictEqual(logOutput.length, 1);
            assert(logOutput[0].includes('[SUCCESS]'));
            assert(logOutput[0].includes('Test success message'));
        });

        it('should log error messages with red color', () => {
            Logger.error('Test error message');
            assert.strictEqual(logOutput.length, 1);
            assert(logOutput[0].includes('[ERROR]'));
            assert(logOutput[0].includes('Test error message'));
        });

        it('should log warning messages with yellow color', () => {
            Logger.warning('Test warning message');
            assert.strictEqual(logOutput.length, 1);
            assert(logOutput[0].includes('[WARNING]'));
            assert(logOutput[0].includes('Test warning message'));
        });
    });

    describe('Progress bar functionality', () => {
        it('should create a progress bar with correct width', () => {
            const progressBar = Logger.createProgressBar(50, 100, 20);
            // Should contain filled and empty characters
            assert(progressBar.includes('█'));
            assert(progressBar.includes('░'));
        });

        it('should create a full progress bar at 100%', () => {
            const progressBar = Logger.createProgressBar(100, 100, 10);
            // Should be all filled characters
            // eslint-disable-next-line sonarjs/no-control-regex
            const cleanBar = progressBar.replace(new RegExp(String.raw`\u001b\[[0-9;]*m`, 'g'), ''); // Remove ANSI codes
            assert.strictEqual(cleanBar, '██████████');
        });

        it('should create an empty progress bar at 0%', () => {
            const progressBar = Logger.createProgressBar(0, 100, 10);
            // Should be all empty characters
            // eslint-disable-next-line sonarjs/no-control-regex
            const cleanBar = progressBar.replace(new RegExp(String.raw`\u001b\[[0-9;]*m`, 'g'), ''); // Remove ANSI codes
            assert.strictEqual(cleanBar, '░░░░░░░░░░');
        });

        it('should update progress with TTY', () => {
            Logger.updateProgress(25, 100, 'Test Article');
            assert(writeOutput.length > 0);
            const output = writeOutput.join('');
            assert(output.includes('25%'));
            assert(output.includes('(25/100)'));
            assert(output.includes('Test Article'));
        });

        it('should fallback to console.log without TTY', () => {
            process.stdout.isTTY = false;
            Logger.updateProgress(25, 100, 'Test Article');
            // Should use console.log fallback every 5 items
            assert.strictEqual(logOutput.length, 1);
            assert(logOutput[0].includes('Progress: 25/100'));
        });

        it('should truncate long titles', () => {
            const longTitle = 'A'.repeat(60);
            Logger.updateProgress(50, 100, longTitle);
            const output = writeOutput.join('');
            assert(output.includes(`${'A'.repeat(47)}...`));
        });
    });

    describe('Progress finalization', () => {
        it('should write newline when finalizing progress with TTY', () => {
            Logger.finalizeProgress();
            assert(writeOutput.includes('\n'));
        });

        it('should handle progress completion', () => {
            Logger.updateProgress(100, 100, 'Final Article');
            const output = writeOutput.join('');
            assert(output.includes('100%'));
            assert(output.includes('(100/100)'));
            assert(output.endsWith('\n'));
        });
    });
});
