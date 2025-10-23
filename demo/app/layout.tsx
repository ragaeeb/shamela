import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Footer } from './components/footer';

/**
 * Metadata exposed for the demo application.
 */
export const metadata: Metadata = {
    description: 'Interact with Shamela APIs through a right-to-left friendly interface.',
    title: 'Shamela',
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
                <Footer />
            </body>
        </html>
    );
};

export default RootLayout;
