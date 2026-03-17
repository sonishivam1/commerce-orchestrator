import type { Metadata } from 'next';
import { SidebarNav } from '@/components/layout/sidebar-nav';

export const metadata: Metadata = {
    title: 'Dashboard | Commerce Orchestrator',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-[#0A101C] text-slate-100 overflow-hidden font-sans antialiased selection:bg-primary/30">
            {/* The beautiful dark sidebar */}
            <SidebarNav />
            
            {/* Main content container with scroll */}
            <main className="flex-1 overflow-x-hidden overflow-y-auto w-full">
                <div className="container mx-auto p-6 lg:p-10 max-w-7xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
