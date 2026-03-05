'use client';

import { useStore } from '@/lib/store';
import { riskApi, alertsApi, exportToCSV } from '@/lib/api';
import { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend,
} from 'recharts';
import { Download, Siren, RefreshCw } from 'lucide-react';

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

function riskColor(v: number) {
    if (v > 0.8) return '#ff3b3b';
    if (v > 0.6) return '#ff6b00';
    if (v > 0.4) return '#ffaa00';
    if (v > 0.2) return '#00d4ff';
    return '#00e676';
}

const S = {
    label: { ...MONO, fontSize: 9, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase' as const },
    heading: { ...MONO, fontSize: 9, color: '#333', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 },
    panel: { background: '#080808', border: '1px solid rgba(255,255,255,0.05)', padding: 12 },
    value: { ...MONO, fontSize: 22, fontWeight: 800, color: '#f0f0f0', lineHeight: 1 },
};

const chartTooltip = {
    contentStyle: { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
    labelStyle: { color: '#555' },
    cursor: { fill: 'rgba(255,255,255,0.03)' },
};

export default function StatsPanel() {
    const { districts } = useStore();
    const [autoRunning, setAutoRunning] = useState(false);
    const [autoResult, setAutoResult] = useState<any>(null);

    /* ── Aggregate stats ── */
    const total = districts.length;
    const critical = districts.filter(d => d.composite_risk > 0.8).length;
    const high = districts.filter(d => d.composite_risk > 0.6 && d.composite_risk <= 0.8).length;
    const medium = districts.filter(d => d.composite_risk > 0.4 && d.composite_risk <= 0.6).length;
    const low = districts.filter(d => d.composite_risk <= 0.4).length;
    const totalAtRisk = districts.reduce((a, d) => a + (d.people_at_risk || 0), 0);
    const avgRisk = total ? (districts.reduce((a, d) => a + d.composite_risk, 0) / total) : 0;
    const coastal = districts.filter((d: any) => d.coastal_district).length;

    const pieData = [
        { name: 'CRITICAL', value: critical, color: '#ff3b3b' },
        { name: 'HIGH', value: high, color: '#ff6b00' },
        { name: 'MEDIUM', value: medium, color: '#ffaa00' },
        { name: 'LOW+', value: low, color: '#00d4ff' },
    ].filter(d => d.value > 0);

    /* ── Top 10 bar chart ── */
    const barData = [...districts]
        .sort((a, b) => b.composite_risk - a.composite_risk)
        .slice(0, 10)
        .map(d => ({ name: d.name.split(' ')[0], risk: Math.round(d.composite_risk * 100) }));

    /* ── Hazard breakdown ── */
    const avgFlood = total ? districts.reduce((a, d) => a + d.flood_risk, 0) / total : 0;
    const avgCyclone = total ? districts.reduce((a, d) => a + d.cyclone_risk, 0) / total : 0;
    const avgHeat = total ? districts.reduce((a, d) => a + d.heatwave_risk, 0) / total : 0;

    /* ── Auto-alert ── */
    const runAutoAlert = async () => {
        setAutoRunning(true);
        try {
            const res = await riskApi.autoAlert();
            setAutoResult(res);
        } catch (err: any) {
            setAutoResult({ error: err.response?.data?.detail || 'Auto-alert failed' });
        } finally { setAutoRunning(false); }
    };

    /* ── CSV export ── */
    const exportDistricts = () => {
        exportToCSV('crisp_districts', districts.map(d => ({
            district: d.name, state: d.state,
            composite_risk: d.composite_risk.toFixed(3),
            flood_risk: d.flood_risk.toFixed(3),
            cyclone_risk: d.cyclone_risk.toFixed(3),
            heatwave_risk: d.heatwave_risk.toFixed(3),
            people_at_risk: d.people_at_risk,
        })));
    };

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ ...MONO, fontSize: 11, fontWeight: 600, color: '#f0f0f0' }}>Live Statistics</div>
                    <div style={{ ...S.label, marginTop: 2 }}>Real-time risk aggregate view</div>
                </div>
                <button onClick={exportDistricts} style={{
                    ...MONO, fontSize: 9, color: '#00d4ff', background: 'rgba(0,212,255,0.06)',
                    border: '1px solid rgba(0,212,255,0.2)', padding: '5px 10px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.08em',
                }} title="Export district risk CSV">
                    <Download size={10} /> CSV
                </button>
            </div>

            {/* Headline stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 12 }}>
                <StatCard label="Districts Monitored" value={String(total)} color="#00d4ff" />
                <StatCard label="People At Risk" value={`${(totalAtRisk / 1e6).toFixed(1)}M`} color="#ff6b00" />
                <StatCard label="Critical Districts" value={String(critical)} color="#ff3b3b" accent />
                <StatCard label="Avg Risk Score" value={`${Math.round(avgRisk * 100)}%`} color={riskColor(avgRisk)} />
            </div>

            {/* Risk level breakdown donut */}
            {pieData.length > 0 && (
                <div style={{ ...S.panel, marginBottom: 12 }}>
                    <div style={S.heading}>// Risk Distribution</div>
                    <div style={{ height: 140 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} dataKey="value" cx="40%" cy="50%" outerRadius={55} innerRadius={32}>
                                    {pieData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip {...chartTooltip} />
                                <Legend
                                    iconType="circle" iconSize={6}
                                    wrapperStyle={{ ...MONO, fontSize: 9, color: '#555' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Top 10 risk bar chart */}
            <div style={{ ...S.panel, marginBottom: 12 }}>
                <div style={S.heading}>// Top 10 Highest Risk</div>
                <div style={{ height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 0, right: 4, bottom: 0, left: -18 }}>
                            <XAxis dataKey="name" tick={{ fill: '#444', fontSize: 7 }} interval={0} angle={-30} textAnchor="end" height={30} />
                            <YAxis domain={[0, 100]} tick={{ fill: '#333', fontSize: 8 }} />
                            <Tooltip {...chartTooltip} formatter={(v: number) => [`${v}%`, 'Risk']} />
                            <Bar dataKey="risk" radius={0}>
                                {barData.map((entry, i) => (
                                    <Cell key={i} fill={riskColor(entry.risk / 100)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Hazard type breakdown */}
            <div style={{ ...S.panel, marginBottom: 12 }}>
                <div style={S.heading}>// National Hazard Averages</div>
                {[
                    { label: 'Flood', value: avgFlood, color: '#00d4ff' },
                    { label: 'Cyclone', value: avgCyclone, color: '#a78bfa' },
                    { label: 'Heatwave', value: avgHeat, color: '#ffaa00' },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={S.label}>{label}</span>
                            <span style={{ ...MONO, fontSize: 10, color, fontWeight: 600 }}>{Math.round(value * 100)}%</span>
                        </div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.04)' }}>
                            <div style={{ height: '100%', width: `${value * 100}%`, background: color, transition: 'width 0.6s ease' }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Auto-alert section */}
            <div style={{ ...S.panel }}>
                <div style={S.heading}>// Auto-Alert Engine</div>
                <div style={{ ...S.label, marginBottom: 10 }}>
                    Scan all districts and fire alerts where risk &gt; 75%
                </div>
                <button
                    onClick={runAutoAlert}
                    disabled={autoRunning}
                    style={{
                        width: '100%', padding: '10px 0', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 7, cursor: autoRunning ? 'not-allowed' : 'pointer',
                        background: autoRunning ? 'rgba(255,59,59,0.04)' : 'rgba(255,59,59,0.08)',
                        border: '1px solid rgba(255,59,59,0.25)', color: '#ff3b3b',
                        ...MONO, fontSize: 10, letterSpacing: '0.1em', opacity: autoRunning ? 0.6 : 1,
                        transition: 'all 0.15s',
                    }}
                >
                    {autoRunning
                        ? <><RefreshCw size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> SCANNING...</>
                        : <><Siren size={11} /> RUN AUTO-ALERT SCAN</>
                    }
                </button>

                {autoResult && !autoResult.error && (
                    <div style={{ marginTop: 10, ...S.panel, borderColor: 'rgba(0,230,118,0.2)' }} className="fade-in">
                        <div style={{ ...MONO, fontSize: 10, color: '#00e676', marginBottom: 4 }}>
                            ✓ {autoResult.alerts_sent ?? 0} ALERTS DISPATCHED
                        </div>
                        <div style={S.label}>{autoResult.districts_scanned ?? 0} districts scanned</div>
                    </div>
                )}
                {autoResult?.error && (
                    <div style={{ marginTop: 8, ...MONO, fontSize: 10, color: '#ff6b6b' }}>{autoResult.error}</div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, color, accent }: {
    label: string; value: string; color: string; accent?: boolean;
}) {
    return (
        <div style={{
            background: '#080808',
            border: `1px solid ${accent ? color + '30' : 'rgba(255,255,255,0.05)'}`,
            padding: '10px 12px', position: 'relative', overflow: 'hidden',
        }}>
            {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: color, opacity: 0.5 }} />}
            <div style={{ ...S.label, marginBottom: 4 }}>{label}</div>
            <div style={{ ...S.value, color }}>{value}</div>
        </div>
    );
}
