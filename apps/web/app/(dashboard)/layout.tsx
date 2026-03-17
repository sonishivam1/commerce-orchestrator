import type { Metadata } from 'next';
import { SidebarNav } from '@/components/layout/sidebar-nav';

export const metadata: Metadata = {
    title: 'Dashboard | Commerce Orchestrator',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-[#0A101C] text-slate-100 overflow-hidden antialiased selection:bg-primary/30">
            <SidebarNav />
            <main className="flex-1 overflow-x-hidden overflow-y-auto">
                <div className="p-6 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
