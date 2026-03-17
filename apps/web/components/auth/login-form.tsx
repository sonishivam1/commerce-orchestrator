'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { LOGIN } from '@/lib/graphql/mutations';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [login, { loading }] = useMutation(LOGIN, {
        onCompleted(data) {
            localStorage.setItem('access_token', data.login.accessToken);
            router.push('/jobs');
        },
        onError(error) {
            setErrorMsg(error.message);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        login({ variables: { email, password } });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Email</label>
                <div className="relative">
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="hello@example.com"
                        className="w-full bg-[#1A233A] border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-inner"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#1A233A] border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-inner pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {errorMsg}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#1A73E8] hover:bg-[#287DEB] text-white rounded-xl px-4 py-3 text-sm font-semibold transition-all glow-btn shadow-[0_0_20px_rgba(26,115,232,0.3)] disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="text-center mt-4 text-sm text-slate-400">
                New to CDO?{' '}
                <Link href="/register" className="text-[#3BA4F5] hover:text-[#5AB5F7] font-medium transition-colors">
                    Create account
                </Link>
            </div>
        </form>
    );
}
