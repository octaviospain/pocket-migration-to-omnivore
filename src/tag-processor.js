export class TagProcessor {
    static get DEFAULT_TAG_COLOR() {
        return '#EF8C43'; // Default orange color
    }

    /**
     * Process tags string into Omnivore labels
     * @param {string} tagsString - Pipe-separated tags string
     * @returns {Array} Array of label objects
     */
    static processTags(tagsString) {
        if (!tagsString || tagsString.trim() === '') {
            return [];
        }

        // Skip if it looks like a timestamp (pure numbers)
        if (RegExp(/^\d+$/).exec(tagsString)) {
            return [];
        }

        const tagList = tagsString
            .split('|')
            .map(tag => tag.trim())
            .filter(tag => tag && tag.length > 0);

        return tagList.map(tag => ({
            name: tag,
            color: this.DEFAULT_TAG_COLOR,
            description: ''
        }));
    }

    /**
     * Check if tags string contains valid tags
     * @param {string} tagsString - Pipe-separated tags string
     * @returns {boolean} True if has valid tags
     */
    static hasTags(tagsString) {
        return this.processTags(tagsString).length > 0;
    }
}
