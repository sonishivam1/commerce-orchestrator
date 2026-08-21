'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    BriefcaseBusiness,
    KeyRound,
    Inbox,
    Hexagon,
    Settings,
    LogOut,
    FolderKanban,
    Zap,
    BarChart3,
    Plug,
} from 'lucide-react';
import { clearToken, getTenantId } from '@/lib/auth/session';

const primaryNavItems = [
    { href: '/dashboard',   label: 'Dashboard',      icon: LayoutDashboard },
    { href: '/connections', label: 'Connections',     icon: Plug           },
    { href: '/projects',    label: 'Projects',        icon: FolderKanban   },
    { href: '/runs',        label: 'Live Execution',  icon: Zap            },
    { href: '/reports',     label: 'Reconciliation',  icon: BarChart3      },
];

const systemNavItems = [
    { href: '/jobs',        label: 'Jobs',            icon: BriefcaseBusiness },
    { href: '/dlq',         label: 'Dead Letter Queue', icon: Inbox          },
    { href: '/settings',    label: 'Settings',        icon: Settings         },
];

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export function SidebarNav() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = () => {
        clearToken();
        router.push('/login');
    };

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + '/');

    return (
        <aside className="w-64 bg-[#0F172A] border-r border-white/5 flex flex-col h-full z-20 shrink-0">
            {/* Brand */}
            <div className="px-6 py-8">
                <Link href="/dashboard" className="flex items-center gap-3 active:scale-95 transition-transform group">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] group-hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all duration-300">
                        <Hexagon className="h-6 w-6 text-white fill-white/10" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-lg tracking-tight text-white leading-tight">CDO</span>
                        <span className="text-[10px] uppercase font-semibold tracking-[0.2em] text-blue-400/80 leading-none">
                            Orchestrator
                        </span>
                    </div>
                </Link>
            </div>

            {/* Primary Nav */}
            <div className="flex-1 px-4 space-y-6 overflow-y-auto">
                <div>
                    <h3 className="px-3 mb-2 text-[10px] uppercase font-semibold tracking-widest text-slate-500/80">
                        Platform
                    </h3>
                    <nav className="space-y-0.5">
                        {primaryNavItems.map(({ href, label, icon: Icon }) => {
                            const active = isActive(href);
                            const isLiveExecution = href === '/runs';
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                                        active
                                            ? isLiveExecution
                                                ? 'bg-amber-500/10 text-amber-300'
                                                : 'bg-primary/10 text-primary'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]',
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            'h-4 w-4 shrink-0 transition-colors',
                                            active
                                                ? isLiveExecution
                                                    ? 'text-amber-400'
                                                    : 'text-primary'
                                                : 'text-slate-500 group-hover:text-slate-400',
                                        )}
                                    />
                                    <span className="truncate">{label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* System Nav */}
                <div>
                    <h3 className="px-3 mb-2 text-[10px] uppercase font-semibold tracking-widest text-slate-500/80">
                        System
                    </h3>
                    <nav className="space-y-0.5">
                        {systemNavItems.map(({ href, label, icon: Icon }) => {
                            const active = isActive(href);
                            const isDLQ = href === '/dlq';
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                                        active
                                            ? isDLQ
                                                ? 'bg-red-500/10 text-red-400'
                                                : 'bg-white/5 text-white'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]',
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            'h-4 w-4 shrink-0 transition-colors',
                                            active
                                                ? isDLQ
                                                    ? 'text-red-500'
                                                    : 'text-primary'
                                                : 'text-slate-500 group-hover:text-slate-400',
                                        )}
                                    />
                                    <span className="truncate">{label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* User / Logout */}
            <div className="p-4 mt-auto border-t border-white/5 space-y-2">
                <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-slate-600 to-slate-400 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shrink-0">
                        T
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-slate-200 truncate leading-none">Tenant</span>
                        <span className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                            {getTenantId()?.substring(0, 12) ?? '—'}...
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all cursor-pointer"
                >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
