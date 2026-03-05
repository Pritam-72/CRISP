'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { riskApi, exportToCSV } from '@/lib/api';
import { X, Users, ChevronRight, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/* ── Mini SVG sparkline ── */
function Sparkline({ values, color }: { values: number[]; color: string }) {
    if (!values.length || values.length < 2) return null;
    const W = 44, H = 18;
    const min = Math.min(...values);
    const max = Math.max(...values) || 1;
    const pts = values.map((v, i) => {
        const x = (i / (values.length - 1)) * W;
        const y = H - ((v - min) / (max - min || 1)) * H;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width={W} height={H} style={{ flexShrink: 0 }}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
            <circle cx={pts.split(' ').at(-1)?.split(',')[0]} cy={pts.split(' ').at(-1)?.split(',')[1]} r="1.5" fill={color} />
        </svg>
    );
}

const S = {
    label: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', color: '#444', textTransform: 'uppercase' as const },
    value: { fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#c0c0c0' },
    heading: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em', color: '#333', textTransform: 'uppercase' as const, marginBottom: 8 },
    panel: { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', padding: 12 },
};

function riskColor(v: number) {
    if (v > 0.8) return '#ff3b3b';
    if (v > 0.6) return '#ff6b00';
    if (v > 0.3) return '#ffaa00';
    return '#00e676';
}

function RiskBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={S.label}>{label}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color, fontWeight: 600 }}>{Math.round(value * 100)}%</span>
            </div>
            <div className="risk-bar">
                <div className="risk-bar-fill" style={{ width: `${value * 100}%`, background: color }} />
            </div>
        </div>
    );
}

function SHAPBar({ name, value }: { name: string; value: number }) {
    const isPositive = value >= 0;
    const w = Math.min(Math.abs(value) * 200, 100);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ ...S.label, width: 80, flexShrink: 0, color: '#444' }}>{name.replace('_', ' ')}</span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                {!isPositive && <div style={{ height: 3, width: `${w}%`, background: '#00e676', borderRadius: 0 }} />}
                <div style={{ width: 1, height: 10, background: '#222' }} />
                {isPositive && <div style={{ height: 3, width: `${w}%`, background: '#ff3b3b', borderRadius: 0 }} />}
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, width: 44, textAlign: 'right', color: isPositive ? '#ff6b00' : '#00e676' }}>
                {isPositive ? '+' : ''}{value.toFixed(3)}
            </span>
        </div>
    );
}

const chartTooltipStyle = {
    contentStyle: { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
    labelStyle: { color: '#555' },
};

export default function RiskInsightPanel() {
    const { selectedDistrict, setSelectedDistrict, districts } = useStore();
    const [forecast, setForecast] = useState<any[]>([]);

    useEffect(() => {
        if (selectedDistrict) {
            riskApi.getForecast(selectedDistrict.district.id).then((r: any) => {
                setForecast(r.forecast_72h || []);
            }).catch(() => { });
        }
    }, [selectedDistrict]);

    /* ── Default: top-risk list ── */
    if (!selectedDistrict) {
        const csvExport = () => exportToCSV('crisp_risk', districts.map(d => ({
            district: d.name, state: d.state,
            composite: d.composite_risk.toFixed(3),
            flood: d.flood_risk.toFixed(3),
            cyclone: d.cyclone_risk.toFixed(3),
            heatwave: d.heatwave_risk.toFixed(3),
            people_at_risk: d.people_at_risk,
        })));

        return (
            <div style={{ padding: 16 }}>
                <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: '#f0f0f0' }}>Risk Intelligence</div>
                        <div style={{ ...S.label, marginTop: 2 }}>Click a district on the map for details</div>
                    </div>
                    <button onClick={csvExport} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#00d4ff', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.08em' }}>
                        <Download size={10} /> CSV
                    </button>
                </div>

                <div style={S.heading}>// Highest Risk — Live</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {[...districts]
                        .sort((a, b) => b.composite_risk - a.composite_risk)
                        .slice(0, 8)
                        .map((d, i) => (
                            <button
                                key={d.district_id}
                                onClick={async () => {
                                    const detail = await riskApi.getDistrict(d.district_id);
                                    setSelectedDistrict(detail);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px 10px',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    cursor: 'pointer', width: '100%', textAlign: 'left',
                                    transition: 'border-color 0.15s, background 0.15s',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,212,255,0.2)';
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,212,255,0.02)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.04)';
                                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#2a2a2a', width: 16, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: 12, color: '#c0c0c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                                        <div style={{ fontSize: 9, color: '#444', fontFamily: "'JetBrains Mono', monospace" }}>{d.state}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <Sparkline values={[d.flood_risk, d.heatwave_risk, d.cyclone_risk, d.composite_risk, d.composite_risk]} color={riskColor(d.composite_risk)} />
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: riskColor(d.composite_risk), minWidth: 38, textAlign: 'right' }}>
                                        {Math.round(d.composite_risk * 100)}%
                                    </span>
                                </div>
                            </button>
                        ))}
                </div>
                {districts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 32, color: '#2a2a2a', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                        LOADING HEATMAP DATA...
                    </div>
                )}
            </div>
        );
    }

    /* ── District detail view ── */
    const { district, current_risk: r, shap_explanation, history_72h } = selectedDistrict;
    const riskLevel = r.composite_risk > 0.8 ? 'CRITICAL' : r.composite_risk > 0.6 ? 'HIGH' : r.composite_risk > 0.3 ? 'MEDIUM' : 'LOW';
    const rc = riskColor(r.composite_risk);

    const chartData = history_72h.map((h: any) => ({
        t: new Date(h.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        Flood: Math.round(h.flood_risk * 100),
        Cyclone: Math.round(h.cyclone_risk * 100),
        Risk: Math.round(h.composite_risk * 100),
    }));

    const fcastData = forecast.slice(0, 8).map((f: any) => ({
        t: new Date(f.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        Risk: Math.round(f.composite_risk * 100),
        Flood: Math.round(f.flood_risk * 100),
    }));

    return (
        <div style={{ padding: 16 }} className="fade-in">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>{district.name}</div>
                    <div style={S.label}>{district.state}</div>
                </div>
                <button onClick={() => setSelectedDistrict(null)} style={{
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#444', cursor: 'pointer', padding: 4, display: 'flex',
                    transition: 'color 0.15s, border-color 0.15s',
                }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f0f0f0'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#444'; }}
                >
                    <X size={13} />
                </button>
            </div>

            {/* Composite risk */}
            <div style={{ ...S.panel, marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${rc}, transparent)` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={S.label}>Composite Risk</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 36, fontWeight: 800, color: rc, lineHeight: 1, marginTop: 4 }}>
                            {Math.round(r.composite_risk * 100)}<span style={{ fontSize: 18 }}>%</span>
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: rc, marginTop: 4, letterSpacing: '0.12em' }}>{riskLevel}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginBottom: 2 }}>
                            <Users size={10} color="#444" />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: '#c0c0c0' }}>
                                {(r.people_at_risk || 0).toLocaleString()}
                            </span>
                        </div>
                        <div style={S.label}>people at risk</div>
                        <div style={{ ...S.label, marginTop: 6 }}>CONF: {Math.round(r.confidence * 100)}%</div>
                    </div>
                </div>
            </div>

            {/* Hazard breakdown */}
            <div style={{ marginBottom: 12 }}>
                <div style={S.heading}>// Hazard Breakdown</div>
                <RiskBar label="Flood Risk" value={r.flood_risk} color="#00d4ff" />
                <RiskBar label="Cyclone Risk" value={r.cyclone_risk} color="#a78bfa" />
                <RiskBar label="Heatwave Risk" value={r.heatwave_risk} color="#ffaa00" />
            </div>

            {/* 72h History Chart */}
            {chartData.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                    <div style={S.heading}>// 72h Risk History</div>
                    <div style={{ height: 100 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <XAxis dataKey="t" tick={{ fill: '#333', fontSize: 8 }} interval="preserveStartEnd" />
                                <YAxis domain={[0, 100]} tick={{ fill: '#333', fontSize: 8 }} width={22} />
                                <Tooltip {...chartTooltipStyle} />
                                <Line type="monotone" dataKey="Risk" stroke="#00d4ff" strokeWidth={1.5} dot={false} />
                                <Line type="monotone" dataKey="Flood" stroke="#a78bfa" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* 72h Forecast */}
            {fcastData.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                    <div style={S.heading}>// 72h Forecast</div>
                    <div style={{ height: 80 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={fcastData}>
                                <XAxis dataKey="t" tick={{ fill: '#333', fontSize: 8 }} interval="preserveStartEnd" />
                                <YAxis domain={[0, 100]} tick={{ fill: '#333', fontSize: 8 }} width={22} />
                                <Tooltip {...chartTooltipStyle} />
                                <Line type="monotone" dataKey="Risk" stroke="#ffaa00" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                                <Line type="monotone" dataKey="Flood" stroke="#00d4ff" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* SHAP */}
            {Object.keys(shap_explanation).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                    <div style={S.heading}>// AI Explanation (SHAP)</div>
                    <div style={{ ...S.panel }}>
                        {Object.entries(shap_explanation)
                            .sort(([, a], [, b]) => Math.abs(b as number) - Math.abs(a as number))
                            .slice(0, 5)
                            .map(([name, val]) => (
                                <SHAPBar key={name} name={name} value={val as number} />
                            ))}
                    </div>
                    <div style={{ ...S.label, marginTop: 4 }}>RED = increases risk · GREEN = reduces risk</div>
                </div>
            )}

            {/* Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div style={S.panel}>
                    <div style={S.label}>Population</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#c0c0c0', marginTop: 2 }}>
                        {(district.population || 0).toLocaleString()}
                    </div>
                </div>
                <div style={S.panel}>
                    <div style={S.label}>Coastal</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: district.coastal_district ? '#00e676' : '#444', marginTop: 2 }}>
                        {district.coastal_district ? 'YES' : 'NO'}
                    </div>
                </div>
            </div>
        </div>
    );
}
