import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Login | Commerce Orchestrator' };

export default function LoginPage() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md p-8 space-y-6 rounded-lg border bg-card shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold">Sign In</h1>
                    <p className="text-muted-foreground mt-1">Access your Commerce Orchestrator workspace.</p>
                </div>
                {/* TODO: LoginForm component — useMutation(LOGIN) */}
            </div>
        </div>
    );
}
