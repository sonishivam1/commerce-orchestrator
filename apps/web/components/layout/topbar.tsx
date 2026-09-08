'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, History } from 'lucide-react';

export function Topbar() {
    const pathname = usePathname();
    
    // Simple breadcrumb logic based on pathname
    let breadcrumb = 'Command Center';
    if (pathname === '/dashboard') breadcrumb = 'Dashboard';
    else if (pathname === '/connections') breadcrumb = 'Connections';
    else if (pathname.startsWith('/projects/new')) breadcrumb = 'Dashboard / New Migration';
    else if (pathname.startsWith('/projects')) breadcrumb = 'Projects';
    else if (pathname.startsWith('/runs')) breadcrumb = 'Live Execution';
    else if (pathname === '/reports') breadcrumb = 'Reconciliation';
    else if (pathname === '/settings') breadcrumb = 'Settings';

    return (
        <header className="topbar">
            <div className="breadcrumb" id="breadcrumb">
                <span>{breadcrumb}</span>
            </div>
            <div className="topbar-actions">
                <button className="theme-toggle" aria-label="Toggle theme" title="Toggle light/dark">&#9788;</button>
                <button className="btn btn-ghost btn-sm">
                    <History className="w-3 h-3 mr-1.5" />
                    Audit Log
                </button>
                <Link href="/projects/new" className="btn btn-primary btn-sm">
                    <Plus className="w-3 h-3 mr-1.5" strokeWidth={2.5} />
                    New Migration
                </Link>
            </div>
        </header>
    );
}
