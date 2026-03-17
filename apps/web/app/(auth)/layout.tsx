import { Shield, Clock, Layers } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-[#0F1626] text-white selection:bg-primary/30">
            
            {/* Left Box - Branding & Value Props (Hidden on very small mobile) */}
            <div className="hidden lg:flex w-1/2 flex-col justify-center items-center relative overflow-hidden bg-gradient-to-br from-[#0F1626] to-[#0A101C]">
                {/* Abstract geometric background elements */}
                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-teal-500/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
                
                {/* Central Brand */}
                <div className="z-10 flex flex-col items-center">
                    <h1 className="text-8xl font-black mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-[#80D0C7] via-white to-primary glow-text" style={{ textShadow: "0 0 40px rgba(128, 208, 199, 0.4)" }}>
                        CDO
                    </h1>
                    <p className="text-xl font-medium tracking-wide text-slate-300">Commerce Data Orchestrator</p>
                    
                    {/* Features row */}
                    <div className="flex gap-10 mt-20">
                        <Feature icon={<Layers className="h-6 w-6 text-teal-400" />} text="Multi-tenant\nETL Pipeline" />
                        <Feature icon={<Clock className="h-6 w-6 text-teal-400" />} text="Real-time Job\nMonitoring" />
                        <Feature icon={<Shield className="h-6 w-6 text-teal-400" />} text="AES-256 Encrypted\nCredentials" />
                    </div>
                </div>
            </div>

            {/* Right Box - Auth Form */}
            <div className="flex-1 flex flex-col justify-center items-center relative p-6">
                {/* Subtle backlight behind the glass panel */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="w-full max-w-[420px] relative z-10 glass-panel rounded-2xl p-8 sm:p-10">
                    {children}
                </div>
            </div>
            
        </div>
    );
}

function Feature({ icon, text }: { icon: React.ReactNode, text: string }) {
    return (
        <div className="flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full border border-teal-500/20 bg-teal-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.15)]">
                {icon}
            </div>
            <p className="text-xs text-slate-400 leading-snug whitespace-pre-line font-medium">{text}</p>
        </div>
    );
}
