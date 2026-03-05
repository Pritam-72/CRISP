'use client';

import { useStore } from '@/lib/store';
import { exportToCSV } from '@/lib/api';
import { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { Download } from 'lucide-react';

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const S = {
    label: { ...MONO, fontSize: 9, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase' as const },
    heading: { ...MONO, fontSize: 9, color: '#333', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 },
    panel: { background: '#080808', border: '1px solid rgba(255,255,255,0.05)', padding: 12 },
};

const HAZARDS = [
    { key: 'flood_risk', label: 'Flood', color: '#00d4ff' },
    { key: 'cyclone_risk', label: 'Cyclone', color: '#a78bfa' },
    { key: 'heatwave_risk', label: 'Heatwave', color: '#ffaa00' },
];

const tooltipStyle = {
    contentStyle: { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
    cursor: { fill: 'rgba(255,255,255,0.03)' },
};

const SORT_OPTIONS = [
    { value: 'composite_risk', label: 'Composite Risk' },
    { value: 'flood_risk', label: 'Flood Risk' },
    { value: 'cyclone_risk', label: 'Cyclone Risk' },
    { value: 'heatwave_risk', label: 'Heatwave Risk' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['value'];

export default function ComparePanel() {
    const { districts } = useStore();
    const [topN, setTopN] = useState(10);
    const [sortBy, setSortBy] = useState<SortKey>('composite_risk');
    const [stateFilter, setStateFilter] = useState('');

    const states = useMemo(() => {
        const s = new Set(districts.map(d => d.state));
        return Array.from(s).sort();
    }, [districts]);

    const filtered = useMemo(() => {
        let d = stateFilter ? districts.filter(x => x.state === stateFilter) : districts;
        return [...d].sort((a, b) => (b as any)[sortBy] - (a as any)[sortBy]).slice(0, topN);
    }, [districts, topN, sortBy, stateFilter]);

    const chartData = filtered.map(d => ({
        name: d.name.length > 8 ? d.name.slice(0, 8) + '…' : d.name,
        Flood: Math.round(d.flood_risk * 100),
        Cyclone: Math.round(d.cyclone_risk * 100),
        Heat: Math.round(d.heatwave_risk * 100),
        composite: d.composite_risk,
    }));

    const exportCompare = () => {
        exportToCSV('crisp_comparison', filtered.map(d => ({
            district: d.name, state: d.state,
            flood_risk: d.flood_risk.toFixed(3),
            cyclone_risk: d.cyclone_risk.toFixed(3),
            heatwave_risk: d.heatwave_risk.toFixed(3),
            composite_risk: d.composite_risk.toFixed(3),
        })));
    };

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ ...MONO, fontSize: 11, fontWeight: 600, color: '#f0f0f0' }}>Multi-Hazard Compare</div>
                    <div style={{ ...S.label, marginTop: 2 }}>Flood vs Cyclone vs Heatwave</div>
                </div>
                <button onClick={exportCompare} style={{
                    ...MONO, fontSize: 9, color: '#00d4ff', background: 'rgba(0,212,255,0.06)',
                    border: '1px solid rgba(0,212,255,0.2)', padding: '5px 10px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.08em',
                }}>
                    <Download size={10} /> CSV
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 12 }}>
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortKey)}
                    style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)', color: '#888', ...MONO, fontSize: 10, padding: '6px 8px', outline: 'none' }}
                >
                    {SORT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <select
                    value={stateFilter}
                    onChange={e => setStateFilter(e.target.value)}
                    style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)', color: '#888', ...MONO, fontSize: 10, padding: '6px 8px', outline: 'none' }}
                >
                    <option value="">All States</option>
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                    value={topN}
                    onChange={e => setTopN(Number(e.target.value))}
                    style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)', color: '#888', ...MONO, fontSize: 10, padding: '6px 8px', outline: 'none' }}
                >
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value={15}>Top 15</option>
                    <option value={20}>Top 20</option>
                </select>
            </div>

            {/* Grouped bar chart */}
            <div style={{ ...S.panel, marginBottom: 12 }}>
                <div style={S.heading}>// Hazard Comparison (Top {topN})</div>
                <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 24, left: -18 }} barGap={1}>
                            <XAxis dataKey="name" tick={{ fill: '#444', fontSize: 7 }} interval={0} angle={-35} textAnchor="end" height={36} />
                            <YAxis domain={[0, 100]} tick={{ fill: '#333', fontSize: 8 }} />
                            <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`]} />
                            <Legend wrapperStyle={{ ...MONO, fontSize: 9, color: '#555', paddingTop: 4 }} />
                            <Bar dataKey="Flood" fill="#00d4ff" maxBarSize={12} />
                            <Bar dataKey="Cyclone" fill="#a78bfa" maxBarSize={12} />
                            <Bar dataKey="Heat" fill="#ffaa00" maxBarSize={12} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Per-hazard national leaders */}
            {HAZARDS.map(h => {
                const top3 = [...districts]
                    .sort((a, b) => (b as any)[h.key] - (a as any)[h.key])
                    .slice(0, 3);
                return (
                    <div key={h.key} style={{ ...S.panel, marginBottom: 8 }}>
                        <div style={{ ...S.heading }}>// {h.label} — Top 3</div>
                        {top3.map((d, i) => (
                            <div key={d.district_id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                marginBottom: i < 2 ? 5 : 0,
                            }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{ ...MONO, fontSize: 9, color: '#2a2a2a', width: 14 }}>{String(i + 1).padStart(2, '0')}</span>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#c0c0c0' }}>{d.name}</div>
                                        <div style={{ ...S.label, fontSize: 8 }}>{d.state}</div>
                                    </div>
                                </div>
                                <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: h.color }}>
                                    {Math.round((d as any)[h.key] * 100)}%
                                </span>
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
