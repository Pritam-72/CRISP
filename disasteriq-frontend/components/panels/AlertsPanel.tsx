'use client';

import { useEffect, useState } from 'react';
import { alertsApi } from '@/lib/api';
import { useStore } from '@/lib/store';
import { Bell, Check, Send, Smartphone } from 'lucide-react';

type Severity = 'low' | 'medium' | 'high' | 'critical';

const SEV_COLOR: Record<Severity, { text: string; border: string; bg: string }> = {
    low: { text: '#00e676', border: 'rgba(0,230,118,0.25)', bg: 'rgba(0,230,118,0.05)' },
    medium: { text: '#ffaa00', border: 'rgba(255,170,0,0.25)', bg: 'rgba(255,170,0,0.05)' },
    high: { text: '#ff6b00', border: 'rgba(255,107,0,0.25)', bg: 'rgba(255,107,0,0.05)' },
    critical: { text: '#ff3b3b', border: 'rgba(255,59,59,0.3)', bg: 'rgba(255,59,59,0.06)' },
};

const S = {
    label: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', color: '#444', textTransform: 'uppercase' as const },
    heading: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em', color: '#333', textTransform: 'uppercase' as const, marginBottom: 8 },
    panel: { background: '#080808', border: '1px solid rgba(255,255,255,0.05)', padding: 12 },
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 11,
    background: '#000', border: '1px solid rgba(255,255,255,0.08)',
    color: '#c0c0c0', outline: 'none', fontFamily: "'Inter', sans-serif",
};

export default function AlertsPanel() {
    const { districts } = useStore();
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [form, setForm] = useState({ district_id: '', severity: 'high' as Severity, message: '', channel: 'dashboard' });
    const [lastSent, setLastSent] = useState<any>(null);

    useEffect(() => { loadAlerts(); }, []);

    const loadAlerts = async () => {
        setLoading(true);
        try { const data = await alertsApi.getHistory(); setAlerts(data); } catch { }
        finally { setLoading(false); }
    };

    const sendAlert = async () => {
        if (!form.district_id || !form.message) return;
        setSending(true);
        try {
            const result = await alertsApi.send(parseInt(form.district_id), form.severity, form.message, form.channel);
            setLastSent(result);
            setForm(f => ({ ...f, message: '' }));
            await loadAlerts();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to send alert');
        } finally { setSending(false); }
    };

    const acknowledge = async (id: number) => {
        await alertsApi.acknowledge(id);
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    };

    const autoFill = () => {
        const d = districts.find(d => String(d.district_id) === form.district_id);
        if (!d) return;
        setForm(f => ({
            ...f,
            severity: d.composite_risk > 0.8 ? 'critical' : d.composite_risk > 0.6 ? 'high' : 'medium',
            message: `CRISP ALERT: ${d.name} district showing ${Math.round(d.composite_risk * 100)}% composite disaster risk. Est. ${(d.people_at_risk || 0).toLocaleString()} people at risk. Immediate action required.`,
        }));
    };

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: '#f0f0f0' }}>Alert Management</div>
                <div style={{ ...S.label, marginTop: 2 }}>Dispatch SMS / WhatsApp / Dashboard</div>
            </div>

            {/* Send form */}
            <div style={{ ...S.panel, marginBottom: 12 }}>
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)' }} />
                </div>
                <div style={{ ...S.heading, marginBottom: 10 }}>// Send Alert</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <select
                        value={form.district_id}
                        onChange={e => setForm(f => ({ ...f, district_id: e.target.value }))}
                        style={{ ...inputStyle }}
                    >
                        <option value="">Select district...</option>
                        {[...districts].sort((a, b) => b.composite_risk - a.composite_risk).map(d => (
                            <option key={d.district_id} value={d.district_id}>
                                {d.name}, {d.state} — {Math.round(d.composite_risk * 100)}% risk
                            </option>
                        ))}
                    </select>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity }))} style={inputStyle}>
                            <option value="low">LOW</option>
                            <option value="medium">MEDIUM</option>
                            <option value="high">HIGH</option>
                            <option value="critical">CRITICAL</option>
                        </select>
                        <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} style={inputStyle}>
                            <option value="dashboard">Dashboard</option>
                            <option value="sms">SMS</option>
                            <option value="whatsapp">WhatsApp</option>
                        </select>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={S.label}>Message</span>
                            {form.district_id && (
                                <button onClick={autoFill} style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#00d4ff', letterSpacing: '0.08em',
                                }}>
                                    AUTO-FILL ↯
                                </button>
                            )}
                        </div>
                        <textarea
                            rows={3}
                            value={form.message}
                            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                            placeholder="Enter alert message..."
                            style={{ ...inputStyle, resize: 'none', fontFamily: "'Inter', sans-serif" }}
                        />
                    </div>

                    <button
                        onClick={sendAlert}
                        disabled={sending || !form.district_id || !form.message}
                        className="btn-primary"
                        style={{
                            width: '100%', padding: '10px 0',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10, letterSpacing: '0.1em',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                    >
                        {sending
                            ? <><span className="spin" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%' }} /> SENDING...</>
                            : <><Send size={10} /> DISPATCH VIA {form.channel.toUpperCase()}</>
                        }
                    </button>
                </div>
            </div>

            {lastSent && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', marginBottom: 12,
                    background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)',
                }} className="fade-in">
                    <Smartphone size={12} color="#00e676" />
                    <div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#00e676' }}>
                            ALERT {lastSent.delivery?.mode === 'simulated' ? 'SIMULATED' : 'SENT'} ✓
                        </div>
                        <div style={{ ...S.label, marginTop: 1 }}>{lastSent.delivery?.recipient}</div>
                    </div>
                </div>
            )}

            {/* History */}
            <div style={S.heading}>// Recent Alerts</div>
            {loading && <div style={{ ...S.label, textAlign: 'center', padding: 12 }}>LOADING...</div>}
            {!loading && alerts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#1a1a1a' }}>
                    <Bell size={22} style={{ margin: '0 auto 6px' }} />
                    <div style={{ ...S.label }}>No alerts dispatched</div>
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                {alerts.map(a => {
                    const c = SEV_COLOR[a.severity as Severity] || SEV_COLOR.medium;
                    return (
                        <div key={a.id} style={{
                            padding: '8px 10px',
                            background: c.bg, border: `1px solid ${c.border}`,
                            opacity: a.acknowledged ? 0.4 : 1,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: c.text, marginBottom: 2 }}>
                                        {a.district_name} · {a.severity.toUpperCase()}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#666', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                        {a.message}
                                    </div>
                                    <div style={{ ...S.label, marginTop: 3 }}>
                                        via {a.sent_via} · {new Date(a.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                {!a.acknowledged && (
                                    <button onClick={() => acknowledge(a.id)} style={{
                                        background: 'transparent', border: '1px solid rgba(255,255,255,0.05)',
                                        color: '#444', cursor: 'pointer', padding: 4, flexShrink: 0,
                                        display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                                    }}
                                        title="Acknowledge"
                                        onMouseEnter={e => (e.currentTarget.style.color = '#00e676')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#444')}
                                    >
                                        <Check size={11} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
