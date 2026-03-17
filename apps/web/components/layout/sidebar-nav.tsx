'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BriefcaseBusiness, KeyRound, Inbox, LogOut, Network } from 'lucide-react';

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
    const router = useRouter();

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        router.push('/login');
    };

    return (
        <aside className="w-64 bg-[#0F1626] border-r border-slate-800/60 flex flex-col h-full shadow-2xl z-10">
            {/* Brand */}
            <div className="p-7">
                <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                        <div className="absolute inset-0 bg-primary/20 blur-md rounded-full"></div>
                        <Network className="h-6 w-6 text-primary relative z-10" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg tracking-wide text-white flex items-center gap-1">
                            <span className="text-primary glow-text">CDO</span> 
                            <span className="text-sm font-medium text-slate-300">Orchestrator</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-4 py-2 space-y-2">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname.startsWith(href);
                    
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative',
                                isActive
                                    ? 'bg-[#1E293B] text-white shadow-inner border border-slate-700/50'
                                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                            )}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_10px_rgba(79,149,255,0.8)]" />
                            )}
                            <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-300")} />
                            {label}
                        </Link>
                    )
                })}
            </nav>

            {/* Logout */}
            <div className="p-4 mt-auto">
                <button
                    id="logout-btn"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors group border border-transparent hover:border-red-500/20"
                >
                    <LogOut className="h-[18px] w-[18px] text-slate-500 group-hover:text-red-400" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
