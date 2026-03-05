'use client';

import { useEffect, useState } from 'react';
import { reportsApi } from '@/lib/api';
import { useStore } from '@/lib/store';
import { FileText, RefreshCw, X } from 'lucide-react';

const S = {
    label: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', color: '#444', textTransform: 'uppercase' as const },
    heading: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em', color: '#333', textTransform: 'uppercase' as const, marginBottom: 8 },
    panel: { background: '#080808', border: '1px solid rgba(255,255,255,0.05)', padding: 12 },
};

const RISK_COLOR: Record<string, string> = {
    critical: '#ff3b3b', high: '#ff6b00', medium: '#ffaa00', low: '#00e676',
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 11,
    background: '#000', border: '1px solid rgba(255,255,255,0.08)',
    color: '#c0c0c0', outline: 'none', fontFamily: "'Inter', sans-serif",
};

export default function ReportsPanel() {
    const { districts } = useStore();
    const [reports, setReports] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null);
    const [generating, setGenerating] = useState(false);
    const [selectedDistrictId, setSelectedDistrictId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadHistory(); }, []);

    const loadHistory = async () => {
        setLoading(true);
        try { const data = await reportsApi.getHistory(); setReports(data); }
        catch { } finally { setLoading(false); }
    };

    const generate = async () => {
        if (!selectedDistrictId) return;
        setGenerating(true);
        try {
            const report = await reportsApi.generate(parseInt(selectedDistrictId));
            setSelected(report);
            await loadHistory();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Report generation failed');
        } finally { setGenerating(false); }
    };

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: '#f0f0f0' }}>AI Reports</div>
                <div style={{ ...S.label, marginTop: 2 }}>Auto-generated situation reports via AI</div>
            </div>

            {/* Generate */}
            <div style={{ ...S.panel, marginBottom: 12, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.35), transparent)' }} />
                <div style={{ ...S.heading, marginBottom: 10 }}>// Generate Report</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <select
                        value={selectedDistrictId}
                        onChange={e => setSelectedDistrictId(e.target.value)}
                        style={inputStyle}
                    >
                        <option value="">Select district...</option>
                        {[...districts]
                            .sort((a, b) => b.composite_risk - a.composite_risk)
                            .map(d => (
                                <option key={d.district_id} value={d.district_id}>
                                    {d.name}, {d.state} — {Math.round(d.composite_risk * 100)}% risk
                                </option>
                            ))}
                    </select>
                    <button
                        onClick={generate}
                        disabled={generating || !selectedDistrictId}
                        className="btn-primary"
                        style={{
                            width: '100%', padding: '10px 0',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10, letterSpacing: '0.1em',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                    >
                        <FileText size={11} />
                        {generating ? 'GENERATING REPORT...' : 'GENERATE AI REPORT →'}
                    </button>
                </div>
            </div>

            {/* Inline report */}
            {selected && (
                <div style={{ ...S.panel, marginBottom: 12, position: 'relative' }} className="fade-in">
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${RISK_COLOR[selected.risk_level] ?? '#00d4ff'}55, transparent)` }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: '#f0f0f0' }}>{selected.district}</div>
                            <span style={{
                                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                                color: RISK_COLOR[selected.risk_level] ?? '#00d4ff',
                                letterSpacing: '0.1em',
                            }}>
                                {selected.risk_level?.toUpperCase()} RISK
                            </span>
                        </div>
                        <button onClick={() => setSelected(null)} style={{
                            background: 'none', border: '1px solid rgba(255,255,255,0.06)',
                            color: '#444', cursor: 'pointer', padding: 4, display: 'flex',
                        }}>
                            <X size={11} />
                        </button>
                    </div>
                    <div style={{
                        maxHeight: 220, overflowY: 'auto', fontSize: 10,
                        fontFamily: "'JetBrains Mono', monospace", color: '#666',
                        lineHeight: 1.7, whiteSpace: 'pre-wrap',
                    }}>
                        {selected.content}
                    </div>
                </div>
            )}

            {/* History */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={S.heading}>// Report History</div>
                <button onClick={loadHistory} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#333', display: 'flex', transition: 'color 0.15s',
                }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#00d4ff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#333')}
                >
                    <RefreshCw size={11} />
                </button>
            </div>

            {loading && <div style={{ ...S.label, textAlign: 'center', padding: 12 }}>LOADING...</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 260, overflowY: 'auto' }}>
                {reports.map(r => (
                    <button
                        key={r.id}
                        onClick={() => setSelected(r)}
                        style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '9px 10px', width: '100%', textAlign: 'left',
                            background: selected?.id === r.id ? 'rgba(0,212,255,0.04)' : 'transparent',
                            border: selected?.id === r.id ? '1px solid rgba(0,212,255,0.2)' : '1px solid rgba(255,255,255,0.04)',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (selected?.id !== r.id) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
                        onMouseLeave={e => { if (selected?.id !== r.id) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.04)'; }}
                    >
                        <div>
                            <div style={{ fontSize: 12, color: '#c0c0c0', marginBottom: 2 }}>{r.district_name}</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#333' }}>
                                {new Date(r.generated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        <span style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                            color: RISK_COLOR[r.risk_level] ?? '#00d4ff',
                            letterSpacing: '0.08em',
                        }}>
                            {r.risk_level?.toUpperCase()}
                        </span>
                    </button>
                ))}

                {!loading && reports.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '28px 0', color: '#1a1a1a' }}>
                        <FileText size={22} style={{ margin: '0 auto 8px' }} />
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#2a2a2a', letterSpacing: '0.1em' }}>
                            NO REPORTS GENERATED
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
