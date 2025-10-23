import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Metadata exposed for the demo application.
 */
export const metadata: Metadata = {
    title: 'Shamela Demo Explorer',
    description: 'Interact with Shamela APIs through a right-to-left friendly interface.',
};

/**
 * Root layout for the Shamela demo application.
 *
 * @param props - Component properties containing the rendered children
 * @returns The base HTML scaffold for all pages
 */
const RootLayout = ({ children }: { children: ReactNode }) => {
    return (
        <html lang="ar" dir="rtl">
            <body>
                <main>{children}</main>
            </body>
        </html>
    );
};

export default RootLayout;
