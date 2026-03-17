'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BriefcaseBusiness, KeyRound, Inbox, LogOut, Network, LayoutDashboard, Settings, Layers } from 'lucide-react';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/integrations', label: 'Integrations', icon: Layers },
    { href: '/credentials', label: 'Credentials', icon: KeyRound },
    { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
    { href: '/settings', label: 'Settings', icon: Settings },
];

const bottomNavItems = [
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
        <aside className="w-72 bg-[#0A101C] border-r border-[#1E293B]/50 flex flex-col h-full z-20">
            {/* Brand */}
            <div className="p-8">
                <Link href="/jobs" className="flex items-center gap-3 group">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-[0_0_20px_rgba(79,149,255,0.3)] transition-transform group-hover:scale-105">
                        <Network className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-xl tracking-tight text-white leading-none">
                            CDO
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500 mt-1 mr-[-0.2em]">
                            Orchestrator
                        </span>
                    </div>
                </Link>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-4 py-6 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname.startsWith(href) || (href === '/jobs' && pathname === '/');
                    
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group relative',
                                isActive
                                    ? 'bg-[#1E293B] text-white border border-white/5 shadow-lg'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            )}
                        >
                            <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-slate-600 group-hover:text-slate-400")} />
                            {label}
                        </Link>
                    )
                })}

                <div className="pt-8 pb-4">
                    <p className="px-4 text-[10px] uppercase font-bold tracking-widest text-slate-600 mb-2">System</p>
                    {bottomNavItems.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname.startsWith(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group relative',
                                    isActive
                                        ? 'bg-[#1E293B] text-white border border-white/5 shadow-lg'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                )}
                            >
                                <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-slate-600 group-hover:text-slate-400")} />
                                {label}
                            </Link>
                        )
                    })}
                </div>
            </nav>

            {/* Logout */}
            <div className="p-6 border-t border-[#1E293B]/50">
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all group"
                >
                    <LogOut className="h-5 w-5 text-slate-600 group-hover:text-red-400" />
                    Logout
                </button>
            </div>
        </aside>
    );
}
