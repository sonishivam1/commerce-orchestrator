'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { REGISTER } from '@/lib/graphql/mutations';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';

export function RegisterForm() {
    const router = useRouter();

    const [organizationName, setOrgName] = useState('');
    const [name, setName]            = useState('');
    const [email, setEmail]          = useState('');
    const [password, setPassword]    = useState('');
    const [showPassword, setShowPwd] = useState(false);
    const [errorMsg, setErrorMsg]    = useState('');

    const [register, { loading }] = useMutation(REGISTER, {
        onCompleted() {
            router.push('/login?registered=1');
        },
        onError(error) {
            setErrorMsg(error.message.replace(/^GraphQL error:\s*/i, ''));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        register({ variables: { input: { organizationName, name, email, password } } });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Organization name */}
            <div className="space-y-1.5">
                <label className="block text-xs font-semibold tracking-widest uppercase text-white/40">
                    Organization name
                </label>
                <input
                    type="text"
                    required
                    autoComplete="organization"
                    value={organizationName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
                />
            </div>

            {/* Your name */}
            <div className="space-y-1.5">
                <label className="block text-xs font-semibold tracking-widest uppercase text-white/40">
                    Your name
                </label>
                <input
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
                />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
                <label className="block text-xs font-semibold tracking-widest uppercase text-white/40">
                    Email
                </label>
                <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
                />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
                <label className="block text-xs font-semibold tracking-widest uppercase text-white/40">
                    Password
                </label>
                <div className="relative">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 pr-11 py-3 text-sm text-white placeholder-white/20 hover:border-white/[0.12] focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPwd(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {/* Error */}
            {errorMsg && (
                <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Encryption notice */}
            <div className="flex items-center gap-3 bg-emerald-500/[0.06] border border-emerald-500/[0.12] rounded-xl px-4 py-3">
                <ShieldCheck className="h-4 w-4 text-emerald-500/70 shrink-0" />
                <p className="text-xs text-white/30 leading-relaxed">
                    All credentials are AES-256-GCM encrypted at rest.
                    Your password is never stored in plain text.
                </p>
            </div>

            {/* Submit */}
            <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 bg-primary hover:bg-primary/90 disabled:bg-primary/40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 text-sm font-semibold tracking-wide transition-all flex justify-center items-center gap-2 shadow-lg shadow-primary/20"
            >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Creating workspace…' : 'Create account'}
            </button>

            {/* Login link */}
            <p className="text-center text-sm text-white/30">
                Already have an account?{' '}
                <Link href="/login" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                    Sign in
                </Link>
            </p>

        </form>
    );
}
