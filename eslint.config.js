import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import perfectionist from 'eslint-plugin-perfectionist';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import vitest from 'eslint-plugin-vitest';
import vitestGlobals from 'eslint-plugin-vitest-globals';

export default [
    perfectionist.configs['recommended-natural'],
    {
        files: ['**/*.ts'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: {
                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly',
                ...vitestGlobals.environments.globals,
            },
            parser: parser,
            sourceType: 'module',
        },
        plugins: {
            '@typescript-eslint': tseslint,
            import: importPlugin,
            prettier: eslintPluginPrettier,
            vitest,
        },
        rules: {
            ...eslint.configs.recommended.rules,
            ...tseslint.configs.recommended.rules,
            ...eslintConfigPrettier.rules,
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
            'no-plusplus': 'off',
            'prettier/prettier': ['error'],
            radix: 'off',
        },
    },
    {
        ignores: ['node_modules/**'],
    },
];
