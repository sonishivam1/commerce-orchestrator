import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
    title: 'Sign In | Commerce Orchestrator',
    description: 'Log in to manage your ETL pipelines.',
};

export default function LoginPage() {
    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
                <p className="text-sm text-slate-400">Commerce Data Orchestrator</p>
            </div>
            
            <LoginForm />
        </div>
    );
}
