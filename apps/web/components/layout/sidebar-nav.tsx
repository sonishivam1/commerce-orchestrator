'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import {
    LayoutDashboard,
    Plug,
    FolderKanban,
    Zap,
    Settings,
    LogOut,
} from 'lucide-react';
import { clearToken } from '@/lib/auth/session';
import { GET_ME } from '@/lib/graphql/queries/tenant.queries';

const workspaceNavItems = [
    { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
    { href: '/connections', label: 'Connections', icon: Plug            },
];

const migrationsNavItems = [
    { href: '/projects',    label: 'Projects',       icon: FolderKanban },
    { href: '/runs',        label: 'Live Execution', icon: Zap          },
];

const systemNavItems = [
    { href: '/settings',    label: 'Settings',        icon: Settings },
];

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

export function SidebarNav() {
    const pathname = usePathname();
    const router = useRouter();

    const { data: meData } = useQuery<{ me: { id: string; name: string; email: string } }>(GET_ME);
    const me = meData?.me;

    const handleLogout = () => {
        clearToken();
        router.push('/login');
    };

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + '/');

    return (
        <nav className="sidebar" role="navigation" aria-label="Primary">
            <Link href="/dashboard" className="logo" style={{ textDecoration: 'none' }}>
                <div className="logo-mark">CO</div>
                <div>
                    <div className="logo-name">Orchestrator</div>
                    <span className="logo-sub">Commerce Data Platform</span>
                </div>
            </Link>

            <div className="nav-section">
                <div className="nav-label">Workspace</div>
                {workspaceNavItems.map(({ href, label, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={cn('nav-item', isActive(href) && 'active')}
                        style={{ textDecoration: 'none' }}
                    >
                        <Icon className="nav-icon" />
                        {label}
                    </Link>
                ))}
            </div>

            <div className="nav-section">
                <div className="nav-label">Migrations</div>
                {migrationsNavItems.map(({ href, label, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={cn('nav-item', isActive(href) && 'active')}
                        style={{ textDecoration: 'none' }}
                    >
                        <Icon className="nav-icon" />
                        {label}
                    </Link>
                ))}
            </div>

            <div className="nav-section">
                <div className="nav-label">System</div>
                {systemNavItems.map(({ href, label, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={cn('nav-item', isActive(href) && 'active')}
                        style={{ textDecoration: 'none' }}
                    >
                        <Icon className="nav-icon" />
                        {label}
                    </Link>
                ))}
            </div>

            <div className="sidebar-footer">
                <div className="user-row" tabIndex={0}>
                    <div className="avatar">
                        {me?.name?.charAt(0)?.toUpperCase() ?? 'T'}
                    </div>
                    <div className="user-info">
                        <div className="user-name">{me?.name ?? 'User'}</div>
                        <div className="user-email">{me?.email ?? '—'}</div>
                    </div>
                </div>
                <div
                    className="user-row"
                    tabIndex={0}
                    onClick={handleLogout}
                    style={{ marginTop: 4 }}
                >
                    <div className="avatar" style={{ background: 'transparent', border: '1px solid var(--border)' }}>
                        <LogOut className="nav-icon" style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="user-info">
                        <div className="user-name" style={{ color: 'var(--text-muted)' }}>Sign Out</div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
