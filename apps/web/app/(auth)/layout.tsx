import { Shield, Clock, Network, Layers } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-[#0F172A] text-white selection:bg-primary/30 antialiased overflow-hidden">

            {/* Left Box - Branding & Value Props */}
            <div className="hidden lg:flex w-1/2 flex-col justify-center items-center relative bg-geometric border-r border-white/5">
                <div className="bg-geometric-hex" />
                <div className="bg-geometric-circles opacity-40" />

                {/* Central Brand */}
                <div className="z-10 flex flex-col items-center max-w-lg px-10">
                    <div className="relative mb-8 group">
                        <div className="absolute -inset-4 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <h1 className="text-[160px] font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-blue-100 to-blue-400 leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                            CDO
                        </h1>
                    </div>
                    <p className="text-2xl font-bold tracking-tight text-blue-100/90 mb-3">Commerce Data Orchestrator</p>
                    <div className="h-1.5 w-24 bg-gradient-to-r from-primary to-cyan-400 rounded-full mb-20 shadow-lg shadow-primary/20" />

                    {/* Features row */}
                    <div className="grid grid-cols-3 gap-12 w-full max-w-xl">
                        <Feature icon={<Layers className="h-7 w-7 text-emerald-400" />} text="Multi-tenant ETL Pipeline" />
                        <Feature icon={<Clock className="h-7 w-7 text-emerald-400" />} text="Real-time Job Monitoring" />
                        <Feature icon={<Shield className="h-7 w-7 text-emerald-400" />} text="AES-256 Encrypted Credentials" />
                    </div>
                </div>

                {/* Bottom decoration */}
                <div className="absolute bottom-12 left-12 flex items-center gap-2 opacity-40">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-slate-400">System Secure & Operational</span>
                </div>
            </div>

            {/* Right Box - Auth Form */}
            <div className="flex-1 flex flex-col justify-center items-center relative p-8 bg-[#0F172A]">
                {/* Visual backlights */}
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="w-full max-w-[480px] relative z-10 glass-panel rounded-[32px] p-12 lg:p-14 border-white/5 shadow-2xl overflow-hidden group">
                    {/* Inner card light effect */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity" />
                    <div className="relative">{children}</div>
                </div>

                {/* Footer simple link */}
                <div className="mt-12 text-slate-500 text-xs tracking-widest uppercase font-bold opacity-60 hover:opacity-100 transition-opacity cursor-default">
                    &copy; 2026 Commerce Orchestrator. All rights reserved.
                </div>
            </div>

        </div>
    );
}

function Feature({ icon, text }: { icon: React.ReactNode, text: string }) {
    return (
        <div className="flex flex-col items-center text-center gap-5 group/feature">
            <div className="h-16 w-16 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md flex items-center justify-center shadow-xl group-hover/feature:border-emerald-500/30 group-hover/feature:bg-emerald-500/5 transition-all duration-300">
                <div className="p-2 transition-transform duration-300 group-hover/feature:scale-110">
                    {icon}
                </div>
            </div>
            <p className="text-[11px] text-slate-400 group-hover:text-slate-200 leading-snug whitespace-pre-line font-bold tracking-[0.05em] uppercase transition-colors">{text}</p>
        </div>
    );
}

