'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    LayoutDashboard, 
    BriefcaseBusiness, 
    KeyRound, 
    Inbox, 
    Layers,
    Hexagon,
    AlertCircle,
    Settings,
    History
} from 'lucide-react';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
    { href: '/credentials', label: 'Credentials', icon: KeyRound },
    { href: '/dlq', label: 'Dead Letter Queue', icon: Inbox },
];

const bottomItems = [
    { href: '/history', label: 'History', icon: History },
    { href: '/settings', label: 'Settings', icon: Settings },
];

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export function SidebarNav() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-[#0F172A] border-r border-white/5 flex flex-col h-full z-20 shrink-0">
            {/* Brand - Match Premium Preview */}
            <div className="px-6 py-8">
                <Link href="/dashboard" className="flex items-center gap-3 active:scale-95 transition-transform group">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] group-hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all duration-300">
                        <Hexagon className="h-6 w-6 text-white fill-white/10" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-extrabold text-lg tracking-tight text-white leading-tight">CDO</span>
                        <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-400/80 leading-none">
                            Orchestrator
                        </span>
                    </div>
                </Link>
            </div>

            {/* Nav links */}
            <div className="flex-1 px-4 space-y-6">
                <div>
                    <h3 className="px-3 mb-2 text-[10px] uppercase font-bold tracking-widest text-slate-500/80">
                        Main Menu
                    </h3>
                    <nav className="space-y-1">
                        {navItems.map(({ href, label, icon: Icon }) => {
                            const isActive = pathname === href || pathname.startsWith(`${href}/`);
                            const isDLQ = href === '/dlq';
                            
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group relative',
                                        isActive
                                            ? isDLQ 
                                                ? 'bg-red-500/10 text-red-400 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.2)]' 
                                                : 'bg-white/5 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                                    )}
                                >
                                    {isActive && (
                                        <div className={cn(
                                            "absolute left-0 w-1 h-5 rounded-r-full",
                                            isDLQ ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" : "bg-primary shadow-[0_0_10px_rgba(37,99,235,0.8)]"
                                        )} />
                                    )}
                                    <Icon className={cn(
                                        "h-5 w-5 shrink-0 transition-colors",
                                        isActive 
                                            ? isDLQ ? "text-red-500" : "text-primary" 
                                            : "text-slate-500 group-hover:text-slate-400"
                                    )} />
                                    <span className="truncate tracking-wide">{label}</span>
                                    {isDLQ && (
                                        <span className="ml-auto inline-flex items-center justify-center h-5 w-5 rounded-md bg-red-500/20 text-[10px] text-red-400 border border-red-500/20">
                                            3
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div>
                    <h3 className="px-3 mb-2 text-[10px] uppercase font-bold tracking-widest text-slate-500/80">
                        System
                    </h3>
                    <nav className="space-y-1">
                        {bottomItems.map(({ href, label, icon: Icon }) => {
                            const isActive = pathname === href;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group',
                                        isActive
                                            ? 'bg-white/5 text-white'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                                    )}
                                >
                                    <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-400")} />
                                    <span className="truncate tracking-wide">{label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* User Profile - Matching Preview 01 style */}
            <div className="p-4 mt-auto border-t border-white/5">
                <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-slate-600 to-slate-400 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                        SS
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-200 truncate leading-none">Shivam Soni</span>
                        <span className="text-[10px] text-slate-500 truncate mt-0.5">Admin Account</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

