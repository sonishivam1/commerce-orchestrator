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
            {/*
             * font-sans uses Tailwind's default system-font stack.
             * Avoids a runtime dependency on next/font/google (CDN fetch at build time)
             * which can fail in air-gapped CI environments.
             */}
            <body className="font-sans antialiased">
                <ApolloWrapper>{children}</ApolloWrapper>
            </body>
        </html>
    );
}
