import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import vitest from 'eslint-plugin-vitest';
import vitestGlobals from 'eslint-plugin-vitest-globals';
import perfectionist from 'eslint-plugin-perfectionist';

export default [
    {
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 'latest',
            parser: parser,
            sourceType: 'module',
            globals: {
                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly',
                ...vitestGlobals.environments.globals,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            prettier: eslintPluginPrettier,
            vitest,
            import: importPlugin,
            perfectionist,
        },
        rules: {
            ...eslint.configs.recommended.rules,
            ...tseslint.configs.recommended.rules,
            'prettier/prettier': ['error'],
            'no-console': 'off',
            'no-plusplus': 'off',
            radix: 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'perfectionist/sort-imports': [
                'error',
                {
                    type: 'natural',
                    order: 'asc',
                },
            ],
        },
    },
    {
        ignores: ['node_modules/**'],
    },
];
