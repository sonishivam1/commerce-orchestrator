'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@cdo/ui';
import { BriefcaseBusiness, KeyRound, Inbox, LayoutDashboard } from 'lucide-react';

const navItems = [
    { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
    { href: '/credentials', label: 'Credentials', icon: KeyRound },
    { href: '/dlq', label: 'Dead Letter Queue', icon: Inbox },
];

export function SidebarNav() {
    const pathname = usePathname();
    return (
        <aside className="w-64 border-r bg-card flex flex-col">
            <div className="p-6 border-b">
                <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5 text-primary" />
                    <span className="font-bold text-lg">Orchestrator</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Commerce Data Platform</p>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                            pathname.startsWith(href)
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </Link>
                ))}
            </nav>
        </aside>
    );
}
