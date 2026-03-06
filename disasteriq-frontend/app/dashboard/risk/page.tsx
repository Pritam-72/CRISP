'use client';
import { useEffect, useState } from 'react';
import { riskApi } from '@/lib/api';

function riskColor(v: number) {
    if (v > 0.8) return '#ff3b3b';
    if (v > 0.6) return '#ff6b00';
    if (v > 0.3) return '#ffaa00';
    return '#00e676';
}

export default function RiskPage() {
    const [districts, setDistricts] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<'composite' | 'flood' | 'cyclone' | 'heatwave'>('composite');

    useEffect(() => {
        riskApi.getHeatmap().then(setDistricts).catch(() => { });
    }, []);

    const filtered = districts
        .filter(d => d.name?.toLowerCase().includes(search.toLowerCase()) || d.state?.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const key = sort === 'composite' ? 'composite_risk' : `${sort}_risk`;
            return (b[key] ?? 0) - (a[key] ?? 0);
        });

    return (
        <div style={{ minHeight: '100vh', background: '#080c14', padding: 24, fontFamily: "'Inter', sans-serif", color: '#e0e8f0' }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>District Risk Deep-Dive</h1>
                    <p style={{ color: '#5a7fa6', fontSize: 13, margin: '6px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
                        Live XGBoost predictions across all seeded districts
                    </p>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    <input
                        placeholder="Search district or state..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                            padding: '9px 14px', color: '#e0e8f0', fontSize: 13, outline: 'none',
                        }}
                    />
                    {(['composite', 'flood', 'cyclone', 'heatwave'] as const).map(k => (
                        <button key={k} onClick={() => setSort(k)} style={{
                            padding: '8px 14px', borderRadius: 8, border: '1px solid',
                            borderColor: sort === k ? '#00d4ff' : 'rgba(255,255,255,0.1)',
                            background: sort === k ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                            color: sort === k ? '#00d4ff' : '#8a9bb0', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                            textTransform: 'capitalize',
                        }}>
                            {k}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                {['#', 'District', 'State', 'Flood', 'Cyclone', 'Heatwave', 'Composite', 'At Risk'].map(h => (
                                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, color: '#5a7fa6', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((d, i) => {
                                const c = riskColor(d.composite_risk);
                                return (
                                    <tr key={d.district_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                        <td style={{ padding: '11px 14px', color: '#4a5c6e', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{String(i + 1).padStart(2, '0')}</td>
                                        <td style={{ padding: '11px 14px', fontWeight: 600, fontSize: 13 }}>{d.name}</td>
                                        <td style={{ padding: '11px 14px', color: '#8a9bb0', fontSize: 12 }}>{d.state}</td>
                                        {[d.flood_risk, d.cyclone_risk, d.heatwave_risk].map((v, idx) => (
                                            <td key={idx} style={{ padding: '11px 14px' }}>
                                                <span style={{ color: riskColor(v ?? 0), fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600 }}>
                                                    {Math.round((v ?? 0) * 100)}%
                                                </span>
                                            </td>
                                        ))}
                                        <td style={{ padding: '11px 14px' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '3px 10px', borderRadius: 6,
                                                background: `${c}22`, color: c, fontWeight: 700,
                                                fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                                            }}>
                                                {Math.round((d.composite_risk ?? 0) * 100)}%
                                            </span>
                                        </td>
                                        <td style={{ padding: '11px 14px', color: '#c0cad8', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                                            {(d.people_at_risk ?? 0).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 40, color: '#4a5c6e', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                            LOADING RISK DATA... (ensure backend is running)
                        </div>
                    )}
                </div>
                <p style={{ color: '#3a4a5a', fontSize: 11, marginTop: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                    {filtered.length} districts · Updates every 15 minutes via Celery
                </p>
            </div>
        </div>
    );
}
