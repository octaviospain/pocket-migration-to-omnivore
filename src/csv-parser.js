import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

export class CsvParser {
    /**
     * Parse CSV file and return rows
     * @param {string} csvFilePath - Path to CSV file
     * @returns {Promise<Array>} Array of parsed rows
     */
    static async parseCsvFile(csvFilePath) {
        return new Promise((resolve, reject) => {
            const rows = [];
            const parser = parse({
                columns: true,
                skip_empty_lines: true,
                trim: true
            });

            parser.on('readable', () => {
                let record;
                while ((record = parser.read())) {
                    rows.push(record);
                }
            });

            parser.on('error', err => {
                reject(new Error(`CSV parsing error: ${err.message}`));
            });

            parser.on('end', () => {
                resolve(rows);
            });

            const stream = createReadStream(csvFilePath);
            stream.on('error', err => {
                reject(new Error(`File reading error: ${err.message}`));
            });

            stream.pipe(parser);
        });
    }

    /**
     * Validate CSV row data
     * @param {number} rowNum - Row number for error reporting
     * @param {Object} rowData - Row data object
     * @returns {Object} Validated and cleaned row data
     */
    static validateRow(rowNum, rowData) {
        const title = (rowData.title || '').trim();
        const url = (rowData.url || '').trim();
        const timeAdded = (rowData.time_added || '').trim();
        const tags = (rowData.tags || '').trim();
        const status = (rowData.status || '').trim();

        // Validate URL
        if (!url) {
            throw new Error(`Row ${rowNum}: Empty URL found`);
        }

        // Basic URL validation
        try {
            // eslint-disable-next-line no-undef
            new URL(url);
        } catch (error) {
            throw new Error(`Row ${rowNum}: Invalid URL format: ${url} Error: ${error.message}`);
        }

        return {
            title,
            url,
            timeAdded,
            tags,
            status
        };
    }
}
