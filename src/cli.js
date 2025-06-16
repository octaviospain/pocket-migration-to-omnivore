import { Logger } from './logger.js';

export class CLI {
    /**
     * Parse command line arguments
     * @param {Array} args - Command line arguments (usually process.argv.slice(2))
     * @returns {Object} Parsed options
     */
    static parseArgs(args) {
        const options = {
            unreadUntagged: false,
            csvFile: null
        };

        for (const element of args) {
            const arg = element;

            if (arg === '--unread_untagged') {
                options.unreadUntagged = true;
            } else if (arg === '--help' || arg === '-h') {
                this.showHelp();
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
     * Show help message
     */
    static showHelp() {
        console.log('Usage: node import-pocket-to-omnivore.js [options] <csv_file_path>');
        console.log('');
        console.log('Options:');
        console.log("  --unread_untagged    Don't archive articles without tags, even if marked as archived in Pocket");
        console.log('  --help, -h           Show this help message');
        console.log('');
        console.log('Environment Variables:');
        console.log('  OMNIVORE_API_KEY     Your Omnivore API key (required)');
        console.log('  OMNIVORE_BASE_URL    Base URL for your Omnivore instance (optional)');
    }

    /**
     * Validate environment variables
     * @returns {Object} Environment configuration
     */
    static validateEnvironment() {
        const apiKey = process.env.OMNIVORE_API_KEY;
        const baseUrl = process.env.OMNIVORE_BASE_URL;

        if (!apiKey) {
            Logger.error('OMNIVORE_API_KEY environment variable is required');
            Logger.error('Set it with: export OMNIVORE_API_KEY="your-api-key-here"');
            process.exit(1);
        }

        return { apiKey, baseUrl };
    }

    /**
     * Log startup information
     * @param {Object} config - Configuration object
     * @param {Object} options - CLI options
     */
    static logStartup(config, options) {
        Logger.info('Starting Pocket to Omnivore import script');
        Logger.info(`Omnivore Base URL: ${config.baseUrl || 'https://api-prod.omnivore.app'}`);
        Logger.info(`CSV File: ${options.csvFile}`);

        if (options.unreadUntagged) {
            Logger.info('🏷️  Option: --unread_untagged enabled (articles without tags will stay unread)');
        }
    }
}
