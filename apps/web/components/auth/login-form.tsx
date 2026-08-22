'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { LOGIN } from '@/lib/graphql/mutations';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { setToken } from '@/lib/auth/session';

export function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect     = searchParams.get('redirect') ?? '/dashboard';
    const justRegistered = searchParams.get('registered') === '1';

    const [email, setEmail]           = useState('');
    const [password, setPassword]     = useState('');
    const [showPassword, setShowPwd]  = useState(false);
    const [errorMsg, setErrorMsg]     = useState('');

    const [login, { loading }] = useMutation(LOGIN, {
        onCompleted(data) {
            setToken(data.login.accessToken);
            router.push(redirect);
        },
        onError(error) {
            setErrorMsg(error.message.replace(/^GraphQL error:\s*/i, ''));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        login({ variables: { email, password } });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Registration success banner */}
            {justRegistered && (
                <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Account created — sign in to continue.</span>
                </div>
            )}

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
                    placeholder="name@company.com"
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
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
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

            {/* Submit */}
            <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 bg-primary hover:bg-primary/90 disabled:bg-primary/40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 text-sm font-semibold tracking-wide transition-all flex justify-center items-center gap-2 shadow-lg shadow-primary/20"
            >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Signing in…' : 'Sign in'}
            </button>

            {/* Register link */}
            <p className="text-center text-sm text-white/30">
                No account?{' '}
                <Link href="/register" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                    Create one
                </Link>
            </p>

        </form>
    );
}
