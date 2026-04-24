import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = {
    title: 'Create Account | Commerce Orchestrator',
    description: 'Register a new tenant to manage data pipelines.',
};

export default function RegisterPage() {
    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-white">Create an account</h1>
                <p className="text-sm text-slate-400">Join to orchestrate your data streams</p>
            </div>
            
            <RegisterForm />
        </div>
    );
}
