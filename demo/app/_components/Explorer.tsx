'use client';

import { useCallback, useState } from 'react';

/**
 * Serialises values into formatted JSON strings for display.
 *
 * @param value - The value to serialise
 * @returns A prettified JSON string
 */
const toJson = (value: unknown): string => JSON.stringify(value, null, 2);

/**
 * Sends a JSON POST request to the provided endpoint.
 *
 * @param endpoint - Relative API endpoint to call
 * @param payload - Payload to serialise as JSON
 * @returns The parsed JSON body from the response
 */
const postJson = async (endpoint: string, payload: Record<string, unknown>) => {
    const response = await fetch(endpoint, {
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
    });

    const json = (await response.json()) as { data?: unknown; error?: { message: string } };

    if (!response.ok) {
        throw new Error(json.error?.message ?? 'Request failed');
    }

    return json.data;
};

/**
 * Interactive Shamela explorer that wires the library calls to the demo API routes.
 *
 * @returns The rendered explorer component
 */
export const Explorer = () => {
    const [apiKey, setApiKey] = useState('');
    const [bookId, setBookId] = useState('1');
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [masterMetadata, setMasterMetadata] = useState('');
    const [masterSnapshot, setMasterSnapshot] = useState('');
    const [masterDownload, setMasterDownload] = useState('');
    const [bookMetadata, setBookMetadata] = useState('');
    const [bookSnapshot, setBookSnapshot] = useState('');
    const [bookDownload, setBookDownload] = useState('');
    const [coverLink, setCoverLink] = useState('');

    const ensureApiKey = useCallback(() => {
        if (!apiKey) {
            throw new Error('يرجى إدخال مفتاح واجهة برمجة التطبيقات أولاً.');
        }
    }, [apiKey]);

    const withStatus = useCallback(
        async (label: string, runner: () => Promise<void>) => {
            try {
                ensureApiKey();
                setBusy(true);
                setStatus(`جارٍ تنفيذ ${label}…`);
                await runner();
                setStatus('تم بنجاح.');
            } catch (error) {
                setStatus((error as Error).message);
            } finally {
                setBusy(false);
            }
        },
        [ensureApiKey],
    );

    const callEndpoint = useCallback(
        async (endpoint: string, extra: Record<string, unknown>, onSuccess: (data: unknown) => void) => {
            const payload = { apiKey, ...extra };
            const data = await postJson(endpoint, payload);
            onSuccess(data);
        },
        [apiKey],
    );

    const numericBookId = Number.parseInt(bookId, 10) || 0;

    return (
        <section className="explorer">
            <header>
                <h1>مكتبة الشاملة – مساحة تجريبية</h1>
                <p>
                    أدخل مفتاح واجهة برمجة التطبيقات الخاص بك ثم جرّب استدعاء الخدمات المختلفة للتحقق من الإعدادات أو
                    استكشاف البيانات.
                </p>
            </header>

            <div className="form-grid" dir="ltr">
                <label>
                    <span>API Key</span>
                    <input
                        autoComplete="off"
                        onChange={(event) => setApiKey(event.target.value.trim())}
                        placeholder="أدخل المفتاح هنا"
                        type="password"
                        value={apiKey}
                    />
                </label>

                <label>
                    <span>Book ID</span>
                    <input min={1} onChange={(event) => setBookId(event.target.value)} type="number" value={bookId} />
                </label>
            </div>

            <p className="status" role="status">
                {status ?? 'لم يتم تنفيذ أي طلب بعد.'}
            </p>

            <div className="actions" dir="ltr">
                <button
                    disabled={busy}
                    onClick={() =>
                        withStatus('جلب بيانات الماستر', async () => {
                            await callEndpoint('/api/shamela/master/metadata', {}, (data) =>
                                setMasterMetadata(toJson(data)),
                            );
                        })
                    }
                    type="button"
                >
                    Get Master Metadata
                </button>

                <button
                    disabled={busy}
                    onClick={() =>
                        withStatus('تحميل قاعدة الماستر', async () => {
                            await callEndpoint('/api/shamela/master/download', {}, (data) =>
                                setMasterDownload(toJson(data)),
                            );
                        })
                    }
                    type="button"
                >
                    Download Master JSON
                </button>

                <button
                    disabled={busy}
                    onClick={() =>
                        withStatus('تحميل لقطة الماستر إلى الذاكرة', async () => {
                            await callEndpoint('/api/shamela/master', {}, (data) => setMasterSnapshot(toJson(data)));
                        })
                    }
                    type="button"
                >
                    Get Master Snapshot
                </button>

                <button
                    disabled={busy}
                    onClick={() =>
                        withStatus('جلب بيانات الكتاب', async () => {
                            await callEndpoint('/api/shamela/book/metadata', { id: numericBookId }, (data) =>
                                setBookMetadata(toJson(data)),
                            );
                        })
                    }
                    type="button"
                >
                    Get Book Metadata
                </button>

                <button
                    disabled={busy}
                    onClick={() =>
                        withStatus('قراءة الكتاب', async () => {
                            await callEndpoint('/api/shamela/book', { id: numericBookId }, (data) =>
                                setBookSnapshot(toJson(data)),
                            );
                        })
                    }
                    type="button"
                >
                    Get Book Snapshot
                </button>

                <button
                    disabled={busy}
                    onClick={() =>
                        withStatus('تحميل الكتاب كملف JSON', async () => {
                            await callEndpoint('/api/shamela/book/download', { id: numericBookId }, (data) =>
                                setBookDownload(toJson(data)),
                            );
                        })
                    }
                    type="button"
                >
                    Download Book JSON
                </button>

                <button
                    disabled={busy}
                    onClick={() =>
                        withStatus('إنشاء رابط الغلاف', async () => {
                            await callEndpoint('/api/shamela/book/cover', { id: numericBookId }, (data) => {
                                const payload = data as { url: string };
                                setCoverLink(payload.url);
                            });
                        })
                    }
                    type="button"
                >
                    Get Cover URL
                </button>
            </div>

            <div className="results" dir="rtl">
                <article>
                    <h2>بيانات الماستر</h2>
                    <pre>{masterMetadata || '—'}</pre>
                </article>

                <article>
                    <h2>تحميل الماستر</h2>
                    <pre>{masterDownload || '—'}</pre>
                </article>

                <article>
                    <h2>لقطة الماستر</h2>
                    <pre>{masterSnapshot || '—'}</pre>
                </article>

                <article>
                    <h2>بيانات الكتاب</h2>
                    <pre>{bookMetadata || '—'}</pre>
                </article>

                <article>
                    <h2>تحميل الكتاب</h2>
                    <pre>{bookDownload || '—'}</pre>
                </article>

                <article>
                    <h2>لقطة الكتاب</h2>
                    <pre>{bookSnapshot || '—'}</pre>
                </article>

                <article>
                    <h2>رابط الغلاف</h2>
                    {coverLink ? (
                        <a href={coverLink} rel="noreferrer" target="_blank">
                            {coverLink}
                        </a>
                    ) : (
                        <span>—</span>
                    )}
                </article>
            </div>
        </section>
    );
};
