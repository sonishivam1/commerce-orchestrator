import { Zap } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-[#0A101C] text-white antialiased selection:bg-primary/20 overflow-hidden">

            {/* ── Left panel — branding ─────────────────────────────────── */}
            <div className="hidden lg:flex w-[480px] shrink-0 flex-col justify-between relative border-r border-white/[0.06] overflow-hidden">
                {/* Subtle dot-grid pattern */}
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
                        backgroundSize: '28px 28px',
                    }}
                />
                {/* Gradient glow spots */}
                <div className="absolute top-1/3 -left-24 w-72 h-72 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-0 w-56 h-56 bg-indigo-600/10 rounded-full blur-[80px] pointer-events-none" />

                {/* Logo */}
                <div className="relative z-10 p-10">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                            <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-bold tracking-widest uppercase text-white/60">
                            Commerce Orchestrator
                        </span>
                    </div>
                </div>

                {/* Center headline */}
                <div className="relative z-10 px-10 space-y-6">
                    <div className="space-y-3">
                        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/80">
                            Multi-tenant ETL platform
                        </p>
                        <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
                            Move your commerce data with confidence
                        </h2>
                        <p className="text-sm text-white/40 leading-relaxed">
                            Migrate between Shopify, commercetools, and BigCommerce. Encrypted credentials, real-time monitoring, full audit trail.
                        </p>
                    </div>

                    {/* Feature bullets */}
                    <div className="space-y-3 pt-2">
                        {[
                            'AES-256-GCM encrypted at rest',
                            'Tenant-isolated pipelines',
                            'Real-time DLQ replay',
                        ].map((text) => (
                            <div key={text} className="flex items-center gap-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
                                <span className="text-sm text-white/50">{text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer badge */}
                <div className="relative z-10 p-10">
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                            System operational
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Right panel — form ────────────────────────────────────── */}
            <div className="flex-1 flex flex-col justify-center items-center relative p-6 md:p-12">
                {/* Ambient glow */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
                </div>

                {/* Card */}
                <div className="w-full max-w-[420px] relative z-10">
                    <div className="bg-[#131B2C]/80 border border-white/8 rounded-2xl p-8 md:p-10 backdrop-blur-sm shadow-2xl">
                        {children}
                    </div>

                    {/* Bottom link */}
                    <p className="text-center mt-6 text-[11px] text-white/20 uppercase tracking-[0.15em] font-semibold">
                        &copy; {new Date().getFullYear()} Commerce Orchestrator
                    </p>
                </div>
            </div>

        </div>
    );
}
