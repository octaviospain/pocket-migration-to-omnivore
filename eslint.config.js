import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import nodePlugin from 'eslint-plugin-node';
import prettierConfig from 'eslint-config-prettier';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
    // Base configuration for all files
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                global: 'readonly',
                globalThis: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly'
            }
        },
        plugins: {
            import: importPlugin,
            node: nodePlugin
        },
        rules: {
            // JavaScript recommended rules
            ...js.configs.recommended.rules,

            // Import/Export rules
            'import/no-unresolved': 'error',
            'import/named': 'error',
            'import/default': 'error',
            'import/namespace': 'error',
            'import/no-absolute-path': 'error',
            'import/no-dynamic-require': 'warn',
            'import/no-self-import': 'error',
            'import/no-cycle': 'error',
            'import/no-useless-path-segments': 'error',
            'import/consistent-type-specifier-style': ['error', 'prefer-inline'],

            // Node.js specific rules
            'node/no-unsupported-features/es-syntax': 'off', // We're using ES modules
            'node/no-missing-import': 'off', // Handled by import plugin
            'node/no-unpublished-import': 'off', // Allow dev dependencies in tests

            // Code quality rules
            'no-console': 'off', // We need console for CLI tool
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],
            'no-var': 'error',
            'prefer-const': 'error',
            'prefer-arrow-callback': 'error',
            'arrow-spacing': 'error',
            'object-shorthand': 'error',
            'prefer-template': 'error',
            'template-curly-spacing': 'error',
            'quote-props': ['error', 'as-needed'],

            // Style rules (minimal - let Prettier handle most formatting)
            semi: ['error', 'always'],
            quotes: ['error', 'single', { avoidEscape: true }],
            'comma-dangle': ['error', 'never'],
            'no-trailing-spaces': 'error',
            'eol-last': 'error',

            // Best practices
            eqeqeq: ['error', 'always'],
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-new-wrappers': 'error',
            'no-throw-literal': 'error',
            'prefer-promise-reject-errors': 'error',
            radix: 'error',
            'no-return-await': 'error',

            // Error prevention
            'no-unreachable': 'error',
            'no-unreachable-loop': 'error',
            'no-constant-condition': 'error',
            'no-duplicate-imports': 'error',
            'no-self-compare': 'error',
            'no-template-curly-in-string': 'error',
            'array-callback-return': 'error',
            'no-constructor-return': 'error'
        }
    },

    // Test-specific configuration
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                before: 'readonly',
                after: 'readonly'
            }
        },
        rules: {
            // Allow longer test descriptions
            'max-len': 'off',
            // Allow more complex test setup
            'max-lines-per-function': 'off',
            // Allow console in tests for debugging
            'no-console': 'off',
            // Tests often have repetitive patterns
            'no-duplicate-imports': 'off'
        }
    },

    // Configuration files
    {
        files: ['*.config.js', '*.config.mjs'],
        rules: {
            'no-console': 'off',
            'import/no-default-export': 'off'
        }
    },

    {
        ignores: ['node_modules', 'dist/', 'build/', 'coverage/', 'logs/', 'tmp/', 'temp/']
    },

    sonarjs.configs.recommended,

    // Apply Prettier config to disable conflicting rules
    prettierConfig
];
