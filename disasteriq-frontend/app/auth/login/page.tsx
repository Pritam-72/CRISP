'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const DEMO_ACCOUNTS = [
    { label: 'Admin (NDMA HQ)', email: 'admin@disasteriq.in', password: 'demo123', role: 'admin' },
    { label: 'District Officer (Odisha)', email: 'odisha.officer@disasteriq.in', password: 'demo123', role: 'officer' },
    { label: 'NGO (Relief.in)', email: 'ngo@relief.in', password: 'demo123', role: 'ngo' },
];

const ROLE_TAG: Record<string, string> = {
    admin: 'tag tag-purple',
    officer: 'tag tag-cyan',
    ngo: 'tag tag-green',
};

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('admin@disasteriq.in');
    const [password, setPassword] = useState('demo123');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post(`${API}/auth/login`, { email, password });
            localStorage.setItem('disasteriq_token', res.data.access_token);
            localStorage.setItem('disasteriq_role', res.data.role);
            localStorage.setItem('disasteriq_email', res.data.email);
            router.push('/dashboard');
        } catch {
            setError('AUTH FAILED — Invalid credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid-bg min-h-screen flex items-center justify-center p-4" style={{ position: 'relative' }}>
            {/* Corner decorations */}
            <div style={{
                position: 'fixed', top: 0, left: 0, width: 120, height: 120,
                borderRight: 'none', borderBottom: 'none',
                borderTop: '1px solid rgba(0,212,255,0.15)',
                borderLeft: '1px solid rgba(0,212,255,0.15)',
                pointerEvents: 'none', zIndex: 1,
            }} />
            <div style={{
                position: 'fixed', bottom: 0, right: 0, width: 120, height: 120,
                borderTop: 'none', borderLeft: 'none',
                borderBottom: '1px solid rgba(0,212,255,0.15)',
                borderRight: '1px solid rgba(0,212,255,0.15)',
                pointerEvents: 'none', zIndex: 1,
            }} />

            <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 2 }}>

                {/* Header */}
                <div style={{ marginBottom: 32, textAlign: 'center' }}>
                    {/* Logo mark */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 48, height: 48, marginBottom: 16,
                        border: '1px solid rgba(0,212,255,0.4)',
                        background: 'rgba(0,212,255,0.06)',
                        position: 'relative',
                    }}>
                        {/* Corner ticks */}
                        {[
                            { top: -1, left: -1, borderTop: '2px solid #00d4ff', borderLeft: '2px solid #00d4ff', width: 8, height: 8 },
                            { top: -1, right: -1, borderTop: '2px solid #00d4ff', borderRight: '2px solid #00d4ff', width: 8, height: 8 },
                            { bottom: -1, left: -1, borderBottom: '2px solid #00d4ff', borderLeft: '2px solid #00d4ff', width: 8, height: 8 },
                            { bottom: -1, right: -1, borderBottom: '2px solid #00d4ff', borderRight: '2px solid #00d4ff', width: 8, height: 8 },
                        ].map((s, i) => (
                            <div key={i} style={{ position: 'absolute', ...s as React.CSSProperties }} />
                        ))}
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                        </svg>
                    </div>

                    <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <div style={{ fontSize: 11, color: '#444', letterSpacing: '0.2em', marginBottom: 4 }}>
                            SYS://CRISP.GOV.IN
                        </div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em', margin: 0 }}>
                            CRISP
                        </h1>
                        <div style={{ fontSize: 10, color: '#00d4ff', letterSpacing: '0.15em', marginTop: 2 }}>
                            CRISIS RESPONSE INTELLIGENCE & PREDICTION
                        </div>
                    </div>
                </div>

                {/* Login card */}
                <div style={{
                    background: '#0a0a0a',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '24px',
                    position: 'relative',
                }}>
                    {/* Top accent line */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)' }} />

                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.12em', marginBottom: 6 }}>
                                IDENTIFIER
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="input-cyber"
                                style={{ width: '100%', padding: '10px 12px', fontSize: 13 }}
                                placeholder="user@ndma.gov.in"
                                required
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.12em', marginBottom: 6 }}>
                                PASSKEY
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="input-cyber"
                                style={{ width: '100%', padding: '10px 12px', fontSize: 13 }}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div style={{
                                padding: '9px 12px',
                                background: 'rgba(255,59,59,0.08)',
                                border: '1px solid rgba(255,59,59,0.25)',
                                display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <span style={{ width: 6, height: 6, background: '#ff3b3b', borderRadius: '50%', flexShrink: 0 }} />
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#ff3b3b' }}>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                            style={{ padding: '11px 0', fontSize: 12, letterSpacing: '0.1em', width: '100%', fontFamily: "'JetBrains Mono', monospace" }}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <span className="spin" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%' }} />
                                    AUTHENTICATING...
                                </span>
                            ) : 'AUTHENTICATE →'}
                        </button>
                    </form>

                    {/* Demo accounts */}
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#333', letterSpacing: '0.15em', marginBottom: 10 }}>
                            // DEMO ACCESS PRESETS
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {DEMO_ACCOUNTS.map(acc => (
                                <button
                                    key={acc.email}
                                    onClick={() => { setEmail(acc.email); setPassword(acc.password); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '9px 12px',
                                        background: 'transparent',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'border-color 0.15s, background 0.15s',
                                        width: '100%',
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,212,255,0.25)';
                                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,212,255,0.03)';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.05)';
                                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: 12, color: '#c0c0c0', marginBottom: 1 }}>{acc.label}</div>
                                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#444' }}>{acc.email}</div>
                                    </div>
                                    <span className={ROLE_TAG[acc.role]}>{acc.role}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#2a2a2a', letterSpacing: '0.1em' }}>
                    CRISP v1.0 · NDMA INDIA · ALL DATA IS DEMO/SIMULATED
                </div>
            </div>
        </div>
    );
}
