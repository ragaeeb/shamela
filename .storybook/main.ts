import { join } from 'node:path';

import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)'],
    addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
    framework: {
        name: '@storybook/html-vite',
        options: {},
    },
    async viteFinal(baseConfig) {
        if (baseConfig.resolve) {
            baseConfig.resolve.alias = {
                ...(baseConfig.resolve.alias ?? {}),
                '@': join(__dirname, '..', 'src'),
            };
        }

        return baseConfig;
    },
};

export default config;
