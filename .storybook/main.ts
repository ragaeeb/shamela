import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)'],
    addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
    framework: {
        name: '@storybook/html-vite',
        options: {},
    },
    docs: {
        autodocs: 'tag',
    },
};

export default config;
