import type { Preview } from '@storybook/html';

const preview: Preview = {
    parameters: {
        layout: 'fullscreen',
        controls: {
            expanded: true,
        },
    },
    tags: ['autodocs'],
};

export default preview;
