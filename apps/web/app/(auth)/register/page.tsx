import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = {
    title: 'Create Account — Commerce Orchestrator',
    description: 'Register a new tenant to manage data pipelines.',
};

export default function RegisterPage() {
    return (
        <div className="flex flex-col gap-7 w-full">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                    Create an account
                </h1>
                <p className="text-sm text-white/40">
                    Set up your workspace in seconds
                </p>
            </div>

            <RegisterForm />
        </div>
    );
}
