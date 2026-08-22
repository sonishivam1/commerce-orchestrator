import type { Metadata } from 'next';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Topbar } from '@/components/layout/topbar';

export const metadata: Metadata = {
    title: 'Dashboard | Commerce Orchestrator',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {/* Background orbs */}
            <div className="orbs" aria-hidden="true">
                <div className="orb orb-1"></div>
                <div className="orb orb-2"></div>
                <div className="orb orb-3"></div>
            </div>

            <div className="app">
                <SidebarNav />
                <main className="main">
                    <Topbar />
                    <div className="content">
                        {children}
                    </div>
                </main>
            </div>
        </>
    );
}
