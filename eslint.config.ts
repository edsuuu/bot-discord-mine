import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'eslint.config.ts', 'ecosystem.config.cjs'],
    },

    js.configs.recommended,

    ...tseslint.configs.recommended,

    {
        files: ['**/*.ts', '**/*.tsx'],

        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
            },
            globals: {
                ...globals.node,
                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly',
            },
        },

        plugins: {
            '@typescript-eslint': tseslint.plugin,
            import: importPlugin,
            prettier: prettier,
        },

        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.jsx', '.ts', '.tsx'],
                },
            },
        },

        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    args: 'all',
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            indent: ['error', 4],
            'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1, maxBOF: 0 }],
            quotes: ['error', 'single'],
            'import/newline-after-import': 'error',
            '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
            curly: ['error', 'all'],
            'import/order': [
                'error',
                {
                    groups: [['builtin', 'external'], 'internal', 'parent', 'sibling', 'index'],
                    pathGroups: [
                        {
                            pattern: '@/**',
                            group: 'internal',
                        },
                    ],
                    pathGroupsExcludedImportTypes: ['builtin'],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
            'no-empty': ['error', { allowEmptyCatch: true }],
            'prefer-const': 'error',
            eqeqeq: ['error', 'always'],
            '@typescript-eslint/no-explicit-any': 'error',
            'prettier/prettier': 'error',
        },
    },

    prettierConfig,
];
