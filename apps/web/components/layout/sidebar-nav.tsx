'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BriefcaseBusiness, KeyRound, Inbox, Network, Layers } from 'lucide-react';

const navItems = [
    { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
    { href: '/credentials', label: 'Credentials', icon: KeyRound },
    { href: '/dlq', label: 'Dead Letter Queue', icon: Inbox },
];

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export function SidebarNav() {
    const pathname = usePathname();

    return (
        <aside className="w-52 bg-[#0A101C] border-r border-[#1E293B]/50 flex flex-col h-full z-20 shrink-0">
            {/* Brand */}
            <div className="px-5 py-6 border-b border-[#1E293B]/40">
                <Link href="/jobs" className="flex items-center gap-2.5 group">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-[0_0_16px_rgba(79,149,255,0.3)] transition-transform group-hover:scale-105 shrink-0">
                        <Network className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="font-bold text-base tracking-tight text-white leading-none">CDO</span>
                        <span className="text-[9px] uppercase font-bold tracking-[0.18em] text-slate-500 mt-0.5">
                            Orchestrator
                        </span>
                    </div>
                </Link>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname.startsWith(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                                isActive
                                    ? 'bg-[#1E293B] text-white'
                                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                            )}
                        >
                            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-slate-500")} />
                            <span className="truncate">{label}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
