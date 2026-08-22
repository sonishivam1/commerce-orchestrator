import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
    title: 'Sign In — Commerce Orchestrator',
    description: 'Log in to manage your ETL pipelines.',
};

export default function LoginPage() {
    return (
        <div className="flex flex-col gap-7 w-full">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                    Welcome back
                </h1>
                <p className="text-sm text-white/40">
                    Sign in to your workspace
                </p>
            </div>

            {/* LoginForm uses useSearchParams() — requires Suspense in Next.js 14 */}
            <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-white/5" />}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
