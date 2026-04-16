'use client';

import { 
    Settings, 
    Shield, 
    Zap, 
    Database, 
    Globe, 
    Cpu, 
    Lock, 
    Cloud, 
    Activity, 
    ChevronDown,
    ArrowUpRight,
    Server,
    Network
} from 'lucide-react';

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

/* ─── Config Card ────────────────────────────────────────── */
function ConfigCard({
    title,
    subtitle,
    status,
    icon: Icon,
    color = 'blue',
    latency,
    health
}: {
    title: string;
    subtitle: string;
    status: string;
    icon: any;
    color?: 'blue' | 'amber' | 'emerald' | 'indigo';
    latency: string;
    health: string;
}) {
    const themes = {
        blue: 'border-t-blue-500 shadow-blue-500/5 hover:border-blue-500/30',
        amber: 'border-t-amber-500 shadow-amber-500/5 hover:border-amber-500/30',
        emerald: 'border-t-emerald-500 shadow-emerald-500/5 hover:border-emerald-500/30',
        indigo: 'border-t-indigo-500 shadow-indigo-500/5 hover:border-indigo-500/30',
    };

    const iconColors = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    };

    return (
        <div className={cn(
            "bg-[#1E293B]/40 backdrop-blur-md border border-white/5 rounded-[32px] p-8 transition-all duration-500 hover:scale-[1.02] border-t-2 shadow-2xl group",
            themes[color]
        )}>
            <div className="flex items-start justify-between mb-8">
                <div className={cn("h-14 w-14 flex items-center justify-center rounded-2xl border shrink-0 transition-transform group-hover:scale-110", iconColors[color])}>
                    <Icon className="h-7 w-7" />
                </div>
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{status}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Uptime: 99.98%</span>
                </div>
            </div>

            <div className="space-y-1 mb-8">
                <h3 className="text-2xl font-black text-white tracking-tighter">{title}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{subtitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-8 border-b border-white/5">
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Network Latency</p>
                    <p className="text-sm font-bold text-slate-300">{latency}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Shard Health</p>
                    <p className="text-sm font-bold text-slate-300">{health}</p>
                </div>
            </div>

            <button className="w-full mt-6 py-4 rounded-2xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                Configure Node <ArrowUpRight className="h-4 w-4" />
            </button>
        </div>
    );
}

/* ─── Main Settings Page ───────────────────────────────────── */
export default function SettingsPage() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Breadcrumb */}
            <div>
                <nav className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span className="hover:text-primary cursor-pointer transition-colors">Orchestrator</span>
                    <ChevronDown className="h-2 w-2 -rotate-90" />
                    <span className="text-slate-300">System Infrastructure</span>
                </nav>
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-white mb-2">Configuration Mesh</h1>
                        <p className="text-sm font-medium text-slate-400">Manage global infrastructure, secrets, and pipeline sharding</p>
                    </div>
                </div>
            </div>

            {/* Infrastructure Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ConfigCard 
                    title="Gateway Edge" 
                    subtitle="Entry-point Ingress" 
                    status="Active" 
                    icon={Globe} 
                    color="blue"
                    latency="14ms"
                    health="Optimal"
                />
                <ConfigCard 
                    title="Pipeline Shard" 
                    subtitle="Compute Worker" 
                    status="Scaling" 
                    icon={Cpu} 
                    color="amber"
                    latency="2.4ms"
                    health="3 Nodes Active"
                />
                <ConfigCard 
                    title="Persistence" 
                    subtitle="Secure Storage" 
                    status="Connected" 
                    icon={Database} 
                    color="emerald"
                    latency="0.8ms"
                    health="Encrypted"
                />
                <ConfigCard 
                    title="Auth Vault" 
                    subtitle="Credential Engine" 
                    status="Isolated" 
                    icon={Lock} 
                    color="indigo"
                    latency="~1ms"
                    health="AES-256-GCM"
                />
            </div>

            {/* Advanced Section */}
            <div className="bg-[#1E293B]/20 border border-white/5 rounded-[40px] p-10 flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-6">
                    <div className="h-16 w-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Server className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">System Registry</h3>
                        <p className="text-sm font-medium text-slate-500 mt-1">View internal microservice discovery and health logs</p>
                    </div>
                </div>
                <button className="px-8 py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20">
                    Open Registry
                </button>
            </div>

            {/* Security Notice */}
            <div className="flex items-center gap-4 text-slate-600 justify-center pt-8 border-t border-white/5">
                <Shield className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">End-to-End Encryption Protocol v2.4 Active</span>
            </div>
        </div>
    );
}
