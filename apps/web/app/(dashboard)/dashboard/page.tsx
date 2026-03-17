'use client';

import { Activity, BriefcaseBusiness, KeyRound, ShieldCheck, Zap, ArrowUpRight, Clock, CheckCircle2, History } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { GET_JOBS } from '@/lib/graphql/queries/job.queries';
import { GET_CREDENTIALS } from '@/lib/graphql/queries/credential.queries';
import Link from 'next/link';

export default function DashboardPage() {
    const { data: jobsData } = useQuery(GET_JOBS);
    const { data: credsData } = useQuery(GET_CREDENTIALS);

    const jobs = jobsData?.jobs ?? [];
    const credentials = credsData?.credentials ?? [];
    
    const runningJobs = jobs.filter((j: any) => j.status === 'RUNNING').length;
    const failedJobs = jobs.filter((j: any) => j.status === 'FAILED').length;

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-white italic tracking-tighter">System Overview</h1>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1 italic">Real-time control plane telemetry</p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard label="Active Pipelines" value={runningJobs} icon={<Zap className="text-amber-400" />} />
                <MetricCard label="Critical Failures" value={failedJobs} icon={<Activity className="text-red-500" />} isError={failedJobs > 0} />
                <MetricCard label="Stored Vaults" value={credentials.length} icon={<KeyRound className="text-primary" />} />
                <MetricCard label="Uptime" value="99.9%" icon={<ShieldCheck className="text-emerald-500" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Jobs */}
                <div className="bg-[#131B2C]/80 border border-white/5 rounded-[40px] p-10 space-y-8 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-white italic tracking-tight">Recent Pipelines</h3>
                        <Link href="/jobs" className="text-xs font-black text-primary uppercase tracking-widest hover:underline">View All</Link>
                    </div>
                    
                    <div className="space-y-4">
                        {jobs.slice(0, 5).map((job: any) => (
                            <Link 
                                href={`/jobs/${job.id}`} 
                                key={job.id}
                                className="flex items-center justify-between p-5 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-2xl bg-[#0A101C] flex items-center justify-center border border-white/5 shadow-inner">
                                        <BriefcaseBusiness className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white italic tracking-tight uppercase">{job.kind}</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Job-{job.id.substring(0, 8)}</p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest border ${
                                    job.status === 'RUNNING' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                    job.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                    'bg-slate-800 text-slate-500 border-white/5'
                                }`}>
                                    {job.status}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Vault Status */}
                <div className="bg-[#131B2C]/80 border border-white/5 rounded-[40px] p-10 space-y-8 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-white italic tracking-tight">Secrets Vault</h3>
                        <Link href="/credentials" className="text-xs font-black text-primary uppercase tracking-widest hover:underline">Manage</Link>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {['COMMERCETOOLS', 'SHOPIFY', 'BIGCOMMERCE', 'CONTENTFUL'].map(platform => {
                            const count = credentials.filter((c: any) => c.platform === platform).length;
                            return (
                                <div key={platform} className="p-6 rounded-3xl bg-[#0A101C] border border-white/5 space-y-3 shadow-inner">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{platform}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-black text-white italic">{count}</span>
                                        <div className={`h-2 w-2 rounded-full ${count > 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 flex gap-4 items-center">
                        <Clock className="h-5 w-5 text-primary" />
                        <p className="text-xs font-bold text-slate-400 italic">Last security audit completed <span className="text-white">2 hours ago</span>. All secrets are rotation-ready.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon, isError }: { label: string, value: string | number, icon: React.ReactNode, isError?: boolean }) {
    return (
        <div className={`bg-[#131B2C]/80 border border-white/5 rounded-[32px] p-8 space-y-3 shadow-2xl backdrop-blur-md hover:scale-[1.02] transition-transform ${isError ? 'ring-1 ring-red-500/20' : ''}`}>
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{label}</p>
                {icon}
            </div>
            <div className="text-[40px] font-black text-white italic tracking-tighter leading-none">
                {value}
            </div>
        </div>
    );
}
