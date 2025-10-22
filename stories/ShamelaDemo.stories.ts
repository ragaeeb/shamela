import type { Meta, StoryObj } from '@storybook/html';

import { configure, getBook, getMasterMetadata } from '../src/index';

const meta = {
    title: 'Demos/Shamela Explorer',
    parameters: {
        layout: 'fullscreen',
    },
    render: () => {
        const container = document.createElement('section');
        container.style.maxWidth = '960px';
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
            'Provide your Shamela API credentials to fetch master metadata and preview the contents of individual books directly in your browser.';
        intro.style.marginBottom = '1.5rem';

        const form = document.createElement('form');
        form.style.display = 'grid';
        form.style.gap = '1rem';
        form.style.background = '#ffffff';
        form.style.padding = '1.25rem';
        form.style.borderRadius = '12px';
        form.style.boxShadow = '0 1px 4px rgba(15, 23, 42, 0.08)';

        const createField = (
            labelText: string,
            { type = 'text', defaultValue = '', placeholder = '' }: { type?: string; defaultValue?: string; placeholder?: string },
        ) => {
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
            input.value = defaultValue;
            input.placeholder = placeholder;
            input.style.padding = '0.6rem 0.75rem';
            input.style.border = '1px solid #cbd5f5';
            input.style.borderRadius = '8px';
            input.style.fontSize = '0.95rem';

            wrapper.append(label, input);
            return { input, wrapper };
        };

        const apiKeyField = createField('API key', { placeholder: 'Required to access the Shamela API' });
        apiKeyField.input.autocomplete = 'off';
        apiKeyField.input.spellcheck = false;

        const masterEndpointField = createField('Master patch endpoint', {
            defaultValue: 'https://shamela.ws/api/master_patch',
            placeholder: 'https://example.com/master_patch',
        });
        masterEndpointField.input.autocomplete = 'off';
        masterEndpointField.input.spellcheck = false;

        const booksEndpointField = createField('Books endpoint', {
            defaultValue: 'https://shamela.ws/api/books',
            placeholder: 'https://example.com/books',
        });
        booksEndpointField.input.autocomplete = 'off';
        booksEndpointField.input.spellcheck = false;

        const wasmField = createField('sql.js WASM URL (optional)', {
            defaultValue: 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm',
            placeholder: 'Override if you host sql-wasm.wasm yourself',
        });
        wasmField.input.autocomplete = 'off';
        wasmField.input.spellcheck = false;

        const bookIdField = createField('Book ID', { defaultValue: '1', type: 'number', placeholder: 'Enter a numeric book id' });
        bookIdField.input.min = '1';

        form.append(
            apiKeyField.wrapper,
            masterEndpointField.wrapper,
            booksEndpointField.wrapper,
            wasmField.wrapper,
            bookIdField.wrapper,
        );

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.flexWrap = 'wrap';
        controls.style.gap = '0.75rem';

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

        const loadMasterButton = makeButton('Fetch master metadata');
        const loadBookButton = makeButton('Load book preview');

        controls.append(loadMasterButton, loadBookButton);

        const status = document.createElement('p');
        status.style.margin = '1rem 0 0.75rem';
        status.style.fontWeight = '600';
        status.style.color = '#0f172a';
        status.textContent = 'Fill in your credentials and choose an action to begin.';

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

        const masterOutput = createOutput('Master metadata');
        const bookOutput = createOutput('Book content preview');

        const applyConfiguration = () => {
            configure({
                apiKey: apiKeyField.input.value.trim() || undefined,
                booksEndpoint: booksEndpointField.input.value.trim() || undefined,
                masterPatchEndpoint: masterEndpointField.input.value.trim() || undefined,
                sqlJsWasmUrl: wasmField.input.value.trim() || undefined,
            });
        };

        const setStatus = (message: string, tone: 'default' | 'success' | 'error') => {
            status.textContent = message;
            switch (tone) {
                case 'success':
                    status.style.color = '#166534';
                    break;
                case 'error':
                    status.style.color = '#b91c1c';
                    break;
                default:
                    status.style.color = '#0f172a';
            }
        };

        loadMasterButton.addEventListener('click', async () => {
            applyConfiguration();
            setStatus('Loading master metadata...', 'default');
            try {
                const metadata = await getMasterMetadata();
                masterOutput.output.textContent = JSON.stringify(metadata, null, 2);
                setStatus('Master metadata fetched successfully.', 'success');
            } catch (error) {
                masterOutput.output.textContent = 'No data available.';
                setStatus(`Failed to load master metadata: ${(error as Error).message}`, 'error');
            }
        });

        loadBookButton.addEventListener('click', async () => {
            applyConfiguration();
            const rawId = bookIdField.input.value.trim();
            const id = Number.parseInt(rawId, 10);
            if (Number.isNaN(id)) {
                setStatus('Please provide a valid numeric book identifier.', 'error');
                return;
            }

            setStatus(`Fetching book ${id}...`, 'default');
            try {
                const book = await getBook(id);
                const preview = {
                    pageCount: book.pages.length,
                    titleCount: book.titles?.length ?? 0,
                    sampleTitles: book.titles?.slice(0, 5) ?? [],
                    samplePages: book.pages.slice(0, 3),
                };
                bookOutput.output.textContent = `${JSON.stringify(preview, null, 2)}\n\nOnly a subset of the book is shown for brevity.`;
                setStatus(`Book ${id} loaded successfully.`, 'success');
            } catch (error) {
                bookOutput.output.textContent = 'Unable to load book data.';
                setStatus(`Failed to fetch book ${id}: ${(error as Error).message}`, 'error');
            }
        });

        const footerNote = document.createElement('p');
        footerNote.style.marginTop = '1.5rem';
        footerNote.style.fontSize = '0.85rem';
        footerNote.style.color = '#475569';
        footerNote.textContent =
            'No data is stored by this demo. All requests are sent directly to the Shamela APIs using your credentials.';

        container.append(heading, intro, form, controls, status, masterOutput.wrapper, bookOutput.wrapper, footerNote);

        return container;
    },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Explorer: Story = {};
