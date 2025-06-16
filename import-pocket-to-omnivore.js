#!/usr/bin/env node

/**
 * Pocket to Omnivore Import Script using Official Node.js Client
 *
 * Usage: node import-pocket-to-omnivore.js [options] <csv_file_path>
 *
 * Options:
 *   --unread_untagged Don't archive articles without tags, even if marked as archived in Pocket
 *
 * Environment Variables:
 * - OMNIVORE_API_KEY: Your Omnivore API key (required)
 * - OMNIVORE_BASE_URL: Base URL for your Omnivore instance (optional, defaults to https://api-prod.omnivore.app)
 */

import { PocketToOmnivoreImporter } from './src/importer.js';
import { CLI } from './src/cli.js';
import { Logger } from './src/logger.js';

/**
 * Main function
 */
async function main() {
    try {
        // Parse command line arguments
        const options = CLI.parseArgs(process.argv.slice(2));

        // Validate environment variables
        const config = CLI.validateEnvironment();

        // Log startup information
        CLI.logStartup(config, options);

        // Create importer and run
        const importer = new PocketToOmnivoreImporter(config.apiKey, config.baseUrl, {
            unreadUntagged: options.unreadUntagged
        });

        await importer.importFromCsv(options.csvFile);
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
