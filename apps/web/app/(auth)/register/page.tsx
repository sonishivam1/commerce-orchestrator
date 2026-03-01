import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Register | Commerce Orchestrator' };

export default function RegisterPage() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md p-8 space-y-6 rounded-lg border bg-card shadow-sm">
                <h1 className="text-2xl font-bold">Create Account</h1>
                {/* TODO: RegisterForm component — useMutation(CREATE_TENANT) */}
            </div>
        </div>
    );
}
