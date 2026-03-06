'use client';
import { useEffect, useState } from 'react';
import { alertsApi } from '@/lib/api';

const SEVERITY_COLOR: Record<string, string> = {
    critical: '#ff3b3b', high: '#ff6b00', medium: '#ffaa00', low: '#00e676',
};

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [sending, setSending] = useState(false);
    const [form, setForm] = useState({ district_id: 1, severity: 'high', message: '', channel: 'dashboard' });
    const [feedback, setFeedback] = useState('');

    useEffect(() => { alertsApi.getHistory().then(setAlerts).catch(() => { }); }, []);

    async function sendAlert(e: React.FormEvent) {
        e.preventDefault();
        setSending(true);
        setFeedback('');
        try {
            await alertsApi.send(form.district_id, form.severity, form.message, form.channel);
            setFeedback('✅ Alert dispatched successfully');
            const updated = await alertsApi.getHistory();
            setAlerts(updated);
        } catch (err: any) {
            setFeedback(`⚠️ ${err.message || 'Failed to send alert'}`);
        } finally {
            setSending(false);
        }
    }

    async function acknowledge(id: number) {
        await alertsApi.acknowledge(id).catch(() => { });
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    }

    const S = {
        card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 } as React.CSSProperties,
        label: { fontSize: 11, color: '#5a7fa6', textTransform: 'uppercase' as const, letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace" },
        input: {
            width: '100%', boxSizing: 'border-box' as const,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '10px 12px', color: '#e0e8f0', fontSize: 13, outline: 'none',
        } as React.CSSProperties,
    };

    return (
        <div style={{ minHeight: '100vh', background: '#080c14', padding: 24, fontFamily: "'Inter', sans-serif", color: '#e0e8f0' }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Alert Management</h1>
                    <p style={{ color: '#5a7fa6', fontSize: 13, margin: '6px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
                        Send SMS / WhatsApp / Dashboard alerts · Twilio + Confidence gate
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
                    {/* Send Form */}
                    <div style={S.card}>
                        <div style={{ ...S.label, marginBottom: 16 }}>Dispatch Alert</div>
                        <form onSubmit={sendAlert} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <div style={{ ...S.label, marginBottom: 6 }}>District ID</div>
                                <input type="number" value={form.district_id} onChange={e => setForm(f => ({ ...f, district_id: +e.target.value }))} style={S.input} min={1} required />
                            </div>
                            <div>
                                <div style={{ ...S.label, marginBottom: 6 }}>Severity</div>
                                <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={{ ...S.input, cursor: 'pointer' }}>
                                    {['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div>
                                <div style={{ ...S.label, marginBottom: 6 }}>Channel</div>
                                <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} style={{ ...S.input, cursor: 'pointer' }}>
                                    {['dashboard', 'sms', 'whatsapp'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <div style={{ ...S.label, marginBottom: 6 }}>Message</div>
                                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required rows={4}
                                    placeholder="Immediate evacuation advisory for coastal zones..."
                                    style={{ ...S.input, resize: 'vertical' as const }} />
                            </div>
                            {feedback && (
                                <div style={{ padding: '9px 12px', borderRadius: 8, fontSize: 13, color: feedback.startsWith('✅') ? '#00e676' : '#ff6b6b', background: feedback.startsWith('✅') ? 'rgba(0,230,118,0.1)' : 'rgba(255,59,48,0.1)' }}>
                                    {feedback}
                                </div>
                            )}
                            <button id="send-alert-btn" type="submit" disabled={sending} style={{
                                padding: '12px', borderRadius: 10, border: 'none',
                                background: sending ? 'rgba(255,170,0,0.2)' : 'linear-gradient(135deg, #ff6b00, #ffaa00)',
                                color: '#000', fontWeight: 700, fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer',
                            }}>
                                {sending ? '⏳ Sending...' : '🚨 Dispatch Alert'}
                            </button>
                        </form>
                    </div>

                    {/* Alert History */}
                    <div style={S.card}>
                        <div style={{ ...S.label, marginBottom: 16 }}>Alert History ({alerts.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
                            {alerts.length === 0 && (
                                <div style={{ textAlign: 'center', padding: 40, color: '#4a5c6e', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                                    NO ALERTS YET
                                </div>
                            )}
                            {alerts.map((a: any) => {
                                const sc = SEVERITY_COLOR[a.severity] || '#8a9bb0';
                                return (
                                    <div key={a.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                        padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                                        border: `1px solid ${a.acknowledged ? 'rgba(255,255,255,0.04)' : sc + '44'}`,
                                        opacity: a.acknowledged ? 0.5 : 1, transition: 'opacity 0.2s',
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                                <span style={{ padding: '2px 8px', borderRadius: 4, background: sc + '22', color: sc, fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>{a.severity}</span>
                                                <span style={{ fontSize: 11, color: '#5a7fa6' }}>District #{a.district_id}</span>
                                                <span style={{ fontSize: 11, color: '#3a4a5a' }}>via {a.sent_via}</span>
                                            </div>
                                            <div style={{ fontSize: 13, color: '#c0cad8', lineHeight: 1.5 }}>{a.message}</div>
                                            <div style={{ fontSize: 11, color: '#3a4a5a', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                                                {new Date(a.sent_at).toLocaleString('en-IN')}
                                            </div>
                                        </div>
                                        {!a.acknowledged && (
                                            <button onClick={() => acknowledge(a.id)} style={{
                                                marginLeft: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(0,230,118,0.3)',
                                                background: 'rgba(0,230,118,0.08)', color: '#00e676', cursor: 'pointer', fontSize: 11, flexShrink: 0,
                                            }}>ACK</button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
