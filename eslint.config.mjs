import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import perfectionist from 'eslint-plugin-perfectionist';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    perfectionist.configs['recommended-natural'],
    {
        languageOptions: {
            ecmaVersion: 'latest',
            globals: { ...globals.nodeBuiltin, Bun: 'readonly' },
            sourceType: 'module',
        },
    },
    { ignores: ['**/dist', '**/coverage', '**/out', '**/build'] },
    eslintConfigPrettier,
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
);
