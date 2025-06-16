import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TagProcessor } from '../src/tag-processor.js';

describe('TagProcessor', () => {
    describe('processTags', () => {
        it('should process valid pipe-separated tags', () => {
            const tagsString = 'tech|programming|javascript';
            const result = TagProcessor.processTags(tagsString);

            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'tech');
            assert.strictEqual(result[0].color, '#EF8C43');
            assert.strictEqual(result[0].description, '');

            assert.strictEqual(result[1].name, 'programming');
            assert.strictEqual(result[2].name, 'javascript');
        });

        it('should handle tags with whitespace', () => {
            const tagsString = ' tech | programming | javascript ';
            const result = TagProcessor.processTags(tagsString);

            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'tech');
            assert.strictEqual(result[1].name, 'programming');
            assert.strictEqual(result[2].name, 'javascript');
        });

        it('should filter out empty tags', () => {
            const tagsString = 'tech||programming|';
            const result = TagProcessor.processTags(tagsString);

            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'tech');
            assert.strictEqual(result[1].name, 'programming');
        });

        it('should return empty array for empty string', () => {
            assert.deepStrictEqual(TagProcessor.processTags(''), []);
            assert.deepStrictEqual(TagProcessor.processTags('   '), []);
        });

        it('should return empty array for null/undefined', () => {
            assert.deepStrictEqual(TagProcessor.processTags(null), []);
            assert.deepStrictEqual(TagProcessor.processTags(undefined), []);
        });

        it('should skip timestamp-like strings', () => {
            const timestampString = '1609459200';
            const result = TagProcessor.processTags(timestampString);

            assert.strictEqual(result.length, 0);
        });

        it('should handle single tag', () => {
            const result = TagProcessor.processTags('technology');

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'technology');
            assert.strictEqual(result[0].color, '#EF8C43');
        });

        it('should handle tags with special characters', () => {
            const tagsString = 'C++|.NET|Node.js|React/Redux';
            const result = TagProcessor.processTags(tagsString);

            assert.strictEqual(result.length, 4);
            assert.strictEqual(result[0].name, 'C++');
            assert.strictEqual(result[1].name, '.NET');
            assert.strictEqual(result[2].name, 'Node.js');
            assert.strictEqual(result[3].name, 'React/Redux');
        });

        it('should handle unicode characters in tags', () => {
            const tagsString = 'español|中文|العربية';
            const result = TagProcessor.processTags(tagsString);

            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'español');
            assert.strictEqual(result[1].name, '中文');
            assert.strictEqual(result[2].name, 'العربية');
        });
    });

    describe('hasTags', () => {
        it('should return true for valid tags', () => {
            assert.strictEqual(TagProcessor.hasTags('tech|programming'), true);
            assert.strictEqual(TagProcessor.hasTags('single-tag'), true);
            assert.strictEqual(TagProcessor.hasTags(' whitespace | tags '), true);
        });

        it('should return false for empty or invalid tags', () => {
            assert.strictEqual(TagProcessor.hasTags(''), false);
            assert.strictEqual(TagProcessor.hasTags('   '), false);
            assert.strictEqual(TagProcessor.hasTags(null), false);
            assert.strictEqual(TagProcessor.hasTags(undefined), false);
            assert.strictEqual(TagProcessor.hasTags('1609459200'), false); // timestamp
        });

        it('should return false for tags that only contain empty values', () => {
            assert.strictEqual(TagProcessor.hasTags('|'), false);
            assert.strictEqual(TagProcessor.hasTags('||'), false);
            assert.strictEqual(TagProcessor.hasTags(' | | '), false);
        });

        it('should return true if at least one valid tag exists', () => {
            assert.strictEqual(TagProcessor.hasTags('tech||'), true);
            assert.strictEqual(TagProcessor.hasTags('|programming|'), true);
        });
    });

    describe('DEFAULT_TAG_COLOR', () => {
        it('should have correct default color', () => {
            assert.strictEqual(TagProcessor.DEFAULT_TAG_COLOR, '#EF8C43');
        });

        it('should use default color in processed tags', () => {
            const result = TagProcessor.processTags('test');
            assert.strictEqual(result[0].color, TagProcessor.DEFAULT_TAG_COLOR);
        });
    });
});
