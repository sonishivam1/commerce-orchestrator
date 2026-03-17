import { Shield, Clock, Network } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-[#0A101C] text-white selection:bg-primary/30">
            
            {/* Left Box - Branding & Value Props */}
            <div className="hidden lg:flex w-1/2 flex-col justify-center items-center relative overflow-hidden bg-geometric">
                {/* Abstract geometric background elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-40" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none opacity-40" />
                
                {/* Central Brand */}
                <div className="z-10 flex flex-col items-center max-w-lg px-10">
                    <h1 className="text-[140px] font-black mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-[#80D0C7] via-white to-primary leading-none glow-text">
                        CDO
                    </h1>
                    <p className="text-2xl font-semibold tracking-tight text-white mb-2 shadow-sm">Commerce Data Orchestrator</p>
                    <div className="h-1 w-20 bg-primary/50 rounded-full mb-16" />
                    
                    {/* Features row */}
                    <div className="grid grid-cols-3 gap-8 w-full">
                        <Feature icon={<Network className="h-6 w-6 text-teal-400" />} text="Multi-tenant\nETL Pipeline" />
                        <Feature icon={<Clock className="h-6 w-6 text-teal-400" />} text="Real-time Job\nMonitoring" />
                        <Feature icon={<Shield className="h-6 w-6 text-teal-400" />} text="AES-256 Encrypted\nCredentials" />
                    </div>
                </div>
            </div>

            {/* Right Box - Auth Form */}
            <div className="flex-1 flex flex-col justify-center items-center relative p-6 bg-[#0F1626]">
                {/* Backlight effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[140px] pointer-events-none opacity-30" />
                <div className="absolute bottom-20 right-20 w-80 h-80 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="w-full max-w-[440px] relative z-10 glass-panel rounded-[24px] p-10 lg:p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-white/10">
                    {children}
                </div>
            </div>
            
        </div>
    );
}

function Feature({ icon, text }: { icon: React.ReactNode, text: string }) {
    return (
        <div className="flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-full border border-teal-500/30 bg-teal-500/10 flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.2)]">
                {icon}
            </div>
            <p className="text-[12px] text-slate-300 leading-tight whitespace-pre-line font-semibold tracking-wide uppercase">{text}</p>
        </div>
    );
}
