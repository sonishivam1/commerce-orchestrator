import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ApolloWrapper } from '@/lib/graphql/apollo-wrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Commerce Orchestrator',
    description: 'Multi-tenant commerce data migration and synchronization platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <ApolloWrapper>{children}</ApolloWrapper>
            </body>
        </html>
    );
}
