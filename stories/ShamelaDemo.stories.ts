import type { Meta, StoryObj } from '@storybook/html';

import { configure, getBook, getMasterMetadata } from '../src/index';

/**
 * Configuration returned from the local proxy server describing the proxied Shamela endpoints.
 */
type ProxyConfiguration = {
    booksEndpoint: string;
    masterEndpoint: string;
};

const PROXY_PORT = 8787;
let proxyConfigPromise: Promise<ProxyConfiguration> | null = null;

/**
 * Computes the origin for the local proxy server based on the current window location.
 *
 * @returns The origin URL pointing at the Bun proxy server
 */
const getProxyOrigin = () => {
    if (typeof window === 'undefined') {
        return `http://localhost:${PROXY_PORT}`;
    }

    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${PROXY_PORT}`;
};

/**
 * Fetches the proxy configuration, caching the response for subsequent requests.
 *
 * @returns The resolved {@link ProxyConfiguration}
 */
const loadProxyConfiguration = async (): Promise<ProxyConfiguration> => {
    if (!proxyConfigPromise) {
        const origin = getProxyOrigin();
        proxyConfigPromise = fetch(`${origin}/__shamela/config`, { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Proxy configuration request failed with status ${response.status}`);
                }

                return response.json() as Promise<Partial<ProxyConfiguration>>;
            })
            .then((payload) => {
                if (!payload.booksEndpoint || !payload.masterEndpoint) {
                    throw new Error('Proxy configuration is missing endpoint mappings.');
                }

                return {
                    booksEndpoint: payload.booksEndpoint,
                    masterEndpoint: payload.masterEndpoint,
                } satisfies ProxyConfiguration;
            });
    }

    return proxyConfigPromise;
};

/**
 * Applies runtime configuration to the library using the provided API key and proxy endpoints.
 *
 * @param apiKey - The Shamela API key entered by the user
 * @returns The resolved proxy configuration
 */
const configureClient = async (apiKey: string) => {
    const proxyConfig = await loadProxyConfiguration();
    configure({
        apiKey: apiKey.trim() || undefined,
        booksEndpoint: proxyConfig.booksEndpoint,
        masterPatchEndpoint: proxyConfig.masterEndpoint,
    });
    return proxyConfig;
};

/**
 * Utility to create a labeled text input field.
 *
 * @param labelText - Text content for the field label
 * @param type - The input type attribute
 * @param placeholder - Placeholder text rendered inside the input
 * @returns The wrapper element alongside the input node
 */
const createField = (labelText: string, type: string, placeholder: string) => {
    const wrapper = document.createElement('label');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '0.35rem';

    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.fontWeight = '600';
    label.style.color = '#0f172a';

    const input = document.createElement('input');
    input.type = type;
    input.placeholder = placeholder;
    input.style.padding = '0.6rem 0.75rem';
    input.style.border = '1px solid #cbd5f5';
    input.style.borderRadius = '8px';
    input.style.fontSize = '0.95rem';

    wrapper.append(label, input);
    return { input, wrapper };
};

/**
 * Produces a styled button with hover interactions.
 *
 * @param label - The visible label for the button
 * @returns The configured button element
 */
const makeButton = (label: string) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.padding = '0.6rem 1.25rem';
    button.style.background = '#2563eb';
    button.style.color = '#ffffff';
    button.style.fontWeight = '600';
    button.style.border = 'none';
    button.style.borderRadius = '999px';
    button.style.cursor = 'pointer';
    button.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.15)';
    button.onmouseenter = () => {
        button.style.background = '#1d4ed8';
    };
    button.onmouseleave = () => {
        button.style.background = '#2563eb';
    };
    return button;
};

/**
 * Creates an output container with a heading and preformatted content area.
 *
 * @param title - Heading text displayed above the output region
 * @returns Both the wrapping element and the preformatted output node
 */
const createOutput = (title: string) => {
    const wrapper = document.createElement('div');
    wrapper.style.background = '#ffffff';
    wrapper.style.borderRadius = '12px';
    wrapper.style.padding = '1rem';
    wrapper.style.boxShadow = '0 1px 4px rgba(15, 23, 42, 0.06)';
    wrapper.style.marginTop = '1rem';

    const headingEl = document.createElement('h2');
    headingEl.textContent = title;
    headingEl.style.margin = '0 0 0.5rem';
    headingEl.style.fontSize = '1.1rem';
    headingEl.style.color = '#1e293b';

    const pre = document.createElement('pre');
    pre.style.background = '#0f172a';
    pre.style.color = '#f8fafc';
    pre.style.padding = '1rem';
    pre.style.borderRadius = '8px';
    pre.style.maxHeight = '320px';
    pre.style.overflow = 'auto';
    pre.style.fontSize = '0.85rem';
    pre.style.lineHeight = '1.4';
    pre.style.margin = '0';
    pre.textContent = 'Waiting for data...';

    wrapper.append(headingEl, pre);
    return { output: pre, wrapper };
};

/**
 * Updates the status indicator message with the appropriate tone styling.
 *
 * @param element - The paragraph element displaying status updates
 * @param message - The status message to render
 * @param tone - Visual tone applied to the status text
 */
const setStatus = (element: HTMLParagraphElement, message: string, tone: 'default' | 'success' | 'error') => {
    element.textContent = message;
    switch (tone) {
        case 'success':
            element.style.color = '#166534';
            break;
        case 'error':
            element.style.color = '#b91c1c';
            break;
        default:
            element.style.color = '#0f172a';
    }
};

const meta = {
    title: 'Demos/Shamela Explorer',
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
    render: () => {
        const container = document.createElement('section');
        container.style.maxWidth = '720px';
        container.style.margin = '0 auto';
        container.style.padding = '1.5rem';
        container.style.fontFamily = 'system-ui, sans-serif';
        container.style.lineHeight = '1.5';
        container.style.background = '#f8fafc';
        container.style.minHeight = '100vh';

        const heading = document.createElement('h1');
        heading.textContent = 'Shamela API explorer';
        heading.style.marginBottom = '0.5rem';

        const intro = document.createElement('p');
        intro.textContent =
            'Enter your Shamela API key to fetch master metadata or preview individual books. The development proxy starts automatically when running the Storybook script, so the browser can reach the Shamela APIs without CORS issues.';
        intro.style.marginBottom = '1.5rem';

        const form = document.createElement('form');
        form.style.display = 'grid';
        form.style.gap = '1rem';
        form.style.background = '#ffffff';
        form.style.padding = '1.25rem';
        form.style.borderRadius = '12px';
        form.style.boxShadow = '0 1px 4px rgba(15, 23, 42, 0.08)';

        const apiKeyField = createField('API key', 'text', 'Required to access the Shamela API');
        apiKeyField.input.autocomplete = 'off';
        apiKeyField.input.spellcheck = false;

        const bookIdField = createField('Book ID', 'number', 'Enter a numeric book id');
        bookIdField.input.min = '1';
        bookIdField.input.value = '1';

        form.append(apiKeyField.wrapper, bookIdField.wrapper);

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.flexWrap = 'wrap';
        controls.style.gap = '0.75rem';

        const loadMasterButton = makeButton('Fetch master metadata');
        const loadBookButton = makeButton('Load book preview');

        controls.append(loadMasterButton, loadBookButton);

        const status = document.createElement('p');
        status.style.margin = '1rem 0 0.75rem';
        status.style.fontWeight = '600';
        status.style.color = '#0f172a';
        status.textContent = 'Provide your API key to begin.';

        const masterOutput = createOutput('Master metadata');
        const bookOutput = createOutput('Book content preview');

        /**
         * Ensures proxy configuration is applied before invoking the provided action.
         *
         * @param action - Callback executed once configuration succeeds
         */
        const withConfiguration = async (action: () => Promise<void>) => {
            const apiKey = apiKeyField.input.value.trim();
            if (!apiKey) {
                setStatus(status, 'Please provide a Shamela API key.', 'error');
                return;
            }

            try {
                await configureClient(apiKey);
            } catch (error) {
                setStatus(
                    status,
                    `Proxy configuration failed: ${(error as Error).message ?? 'Unknown error'}`,
                    'error',
                );
                return;
            }

            await action();
        };

        loadMasterButton.addEventListener('click', () => {
            void withConfiguration(async () => {
                setStatus(status, 'Loading master metadata...', 'default');
                try {
                    const metadata = await getMasterMetadata();
                    masterOutput.output.textContent = JSON.stringify(metadata, null, 2);
                    setStatus(status, 'Master metadata fetched successfully.', 'success');
                } catch (error) {
                    masterOutput.output.textContent = 'No data available.';
                    setStatus(status, `Failed to load master metadata: ${(error as Error).message}`, 'error');
                }
            });
        });

        loadBookButton.addEventListener('click', () => {
            void withConfiguration(async () => {
                const rawId = bookIdField.input.value.trim();
                const id = Number.parseInt(rawId, 10);
                if (Number.isNaN(id)) {
                    setStatus(status, 'Please provide a valid numeric book identifier.', 'error');
                    return;
                }

                setStatus(status, `Fetching book ${id}...`, 'default');
                try {
                    const book = await getBook(id);
                    const preview = {
                        pageCount: book.pages.length,
                        titleCount: book.titles?.length ?? 0,
                        sampleTitles: book.titles?.slice(0, 5) ?? [],
                        samplePages: book.pages.slice(0, 3),
                    };
                    bookOutput.output.textContent = `${JSON.stringify(preview, null, 2)}\n\nOnly a subset of the book is shown for brevity.`;
                    setStatus(status, `Book ${id} loaded successfully.`, 'success');
                } catch (error) {
                    bookOutput.output.textContent = 'Unable to load book data.';
                    setStatus(status, `Failed to fetch book ${id}: ${(error as Error).message}`, 'error');
                }
            });
        });

        const footerNote = document.createElement('p');
        footerNote.style.marginTop = '1.5rem';
        footerNote.style.fontSize = '0.85rem';
        footerNote.style.color = '#475569';
        footerNote.textContent =
            "Requests are proxied through Bun to respect Shamela's CORS policy. Endpoints are sourced from your local environment configuration.";

        container.append(heading, intro, form, controls, status, masterOutput.wrapper, bookOutput.wrapper, footerNote);

        return container;
    },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Explorer: Story = {};
