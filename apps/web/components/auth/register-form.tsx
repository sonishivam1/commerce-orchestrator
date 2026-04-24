'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_TENANT } from '@/lib/graphql/mutations';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, Mail, Lock, Users, ShieldCheck } from 'lucide-react';

export function RegisterForm() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [createTenant, { loading }] = useMutation(CREATE_TENANT, {
        onCompleted() {
            router.push('/login');
        },
        onError(error) {
            setErrorMsg(error.message);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        createTenant({ variables: { input: { name, email, password } } });
    };

    return (
        <div className="flex flex-col w-full">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400/80 ml-1">Workspace / Team Name</label>
                    <div className="relative group/input">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within/input:text-primary transition-colors" />
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Acme Corp."
                            className="w-full bg-[#0F172A]/80 border border-white/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-slate-600 hover:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xl"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400/80 ml-1">Admin Email Address</label>
                    <div className="relative group/input">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within/input:text-primary transition-colors" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="hello@example.com"
                            className="w-full bg-[#0F172A]/80 border border-white/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-slate-600 hover:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xl"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400/80 ml-1">Secure Password</label>
                    <div className="relative group/input">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within/input:text-primary transition-colors" />
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-[#0F172A]/80 border border-white/5 rounded-2xl pl-11 pr-12 py-3.5 text-sm text-white placeholder-slate-600 hover:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xl"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {errorMsg && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3.5 text-[13px] text-red-400 font-medium animate-in fade-in slide-in-from-top-1">
                        {errorMsg}
                    </div>
                )}

                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                    <p className="text-[11px] text-emerald-500/80 font-medium leading-tight">
                        By joining, you agree to our terms and the deployment of encrypted telemetry nodes within your VPC.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-primary hover:bg-primary/90 text-white rounded-2xl px-4 py-4 text-[15px] font-extrabold tracking-tight transition-all glow-btn shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center overflow-hidden hover:scale-[1.02] active:scale-95"
                >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                    {loading ? 'Initializing Workspace...' : 'Create Account'}
                </button>

                <div className="text-center mt-6 text-sm font-medium text-slate-400">
                    Already an orchestrator?{' '}
                    <Link href="/login" className="text-primary hover:underline font-bold transition-all">
                        Sign In
                    </Link>
                </div>
            </form>
        </div>
    );
}
