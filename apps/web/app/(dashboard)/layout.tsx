import type { Metadata } from 'next';
import { SidebarNav } from '@/components/layout/sidebar-nav';

export const metadata: Metadata = {
    title: 'Dashboard | Commerce Orchestrator',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-background">
            <SidebarNav />
            <main className="flex-1 overflow-auto p-8">{children}</main>
        </div>
    );
}
