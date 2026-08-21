import type { Metadata } from 'next';
import './globals.css';
import { ApolloWrapper } from '@/lib/graphql/apollo-wrapper';

export const metadata: Metadata = {
    title: 'Commerce Orchestrator',
    description: 'Multi-tenant commerce data migration and synchronization platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/*
                 * Space Grotesk (display/UI headings) + IBM Plex Mono (data/code) loaded
                 * directly from Google Fonts with a preconnect hint for performance.
                 */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="font-sans antialiased">
                <ApolloWrapper>{children}</ApolloWrapper>
            </body>
        </html>
    );
}
