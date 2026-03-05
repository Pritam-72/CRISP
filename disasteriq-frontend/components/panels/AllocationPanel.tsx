'use client';

import { useState } from 'react';
import { reliefApi, exportToCSV } from '@/lib/api';
import { useStore } from '@/lib/store';
import { Truck, Anchor, Activity, Package, Zap, Clock, MapPin, BarChart3, Download } from 'lucide-react';

const SCENARIOS = [
    { id: 'odisha_cyclone', label: 'Odisha Cyclone' },
    { id: 'gujarat_flood', label: 'Gujarat Flood' },
    { id: 'kerala_flood', label: 'Kerala Flood' },
    { id: 'bihar_flood', label: 'Bihar Flood' },
];

const typeIcons: Record<string, React.ReactNode> = {
    truck: <Truck size={11} />,
    boat: <Anchor size={11} />,
    medical: <Activity size={11} />,
    food: <Package size={11} />,
};

const S = {
    label: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', color: '#444', textTransform: 'uppercase' as const },
    heading: { fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em', color: '#333', textTransform: 'uppercase' as const, marginBottom: 8 },
    panel: { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', padding: 10 },
};

function riskColor(v: number) {
    if (v > 0.8) return '#ff3b3b';
    if (v > 0.6) return '#ff6b00';
    if (v > 0.4) return '#ffaa00';
    return '#00e676';
}

export default function AllocationPanel() {
    const { lastOptimization, setLastOptimization } = useStore();
    const [scenario, setScenario] = useState('odisha_cyclone');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const runOptimization = async () => {
        setLoading(true); setError('');
        try {
            const result = await reliefApi.optimize(scenario);
            setLastOptimization(result);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'OPTIMIZATION FAILED — Admin/Officer role required.');
        } finally { setLoading(false); }
    };

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: '#f0f0f0' }}>Relief Optimizer</div>
                <div style={{ ...S.label, marginTop: 2 }}>OR-Tools VRP Engine · Multi-objective</div>
            </div>

            {/* Scenario selector */}
            <div style={{ marginBottom: 12 }}>
                <div style={S.heading}>// Select Scenario</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {SCENARIOS.map(sc => (
                        <button
                            key={sc.id}
                            onClick={() => setScenario(sc.id)}
                            style={{
                                padding: '8px 10px', fontSize: 11, textAlign: 'left',
                                background: scenario === sc.id ? 'rgba(0,212,255,0.06)' : 'transparent',
                                border: scenario === sc.id ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                color: scenario === sc.id ? '#00d4ff' : '#666',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            {sc.label}
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={runOptimization}
                disabled={loading}
                className="btn-primary"
                style={{
                    width: '100%', padding: '11px 0',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11, letterSpacing: '0.1em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    marginBottom: 12,
                }}
            >
                <Zap size={12} />
                {loading ? 'SOLVING VRP...' : 'RUN OPTIMIZATION →'}
            </button>

            {error && (
                <div style={{
                    padding: '8px 12px', marginBottom: 12,
                    background: 'rgba(255,59,59,0.06)',
                    border: '1px solid rgba(255,59,59,0.2)',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#ff6b6b',
                }}>
                    {error}
                </div>
            )}

            {lastOptimization && (
                <div className="fade-in">
                    {/* Stats row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 12 }}>
                        {[
                            { label: 'Districts', value: lastOptimization.districts_served, color: '#00d4ff' },
                            { label: 'Routes', value: lastOptimization.allocations?.length || 0, color: '#00e676' },
                            { label: 'Opt Score', value: lastOptimization.total_score?.toFixed(1), color: '#ffaa00' },
                        ].map(({ label, value, color }) => (
                            <div key={label} style={{ ...S.panel, textAlign: 'center' }}>
                                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color }}>{value}</div>
                                <div style={{ ...S.label, marginTop: 2 }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Allocations */}
                    <div style={S.heading}>// Allocation Plan</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 280, overflowY: 'auto' }}>
                        {(lastOptimization.allocations || []).map((a: any, i: number) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 10px',
                                background: '#080808',
                                border: '1px solid rgba(255,255,255,0.04)',
                            }}>
                                <span style={{ color: '#444', flexShrink: 0 }}>
                                    {typeIcons[a.resource_type] || <Truck size={11} />}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginBottom: 2 }}>
                                        <span style={{ color: '#444', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.from_district}</span>
                                        <span style={{ color: '#222', fontSize: 10 }}>→</span>
                                        <span style={{ color: '#c0c0c0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.to_district}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#333' }}>
                                        <span><Clock size={8} style={{ display: 'inline', verticalAlign: 'middle' }} /> {a.arrival_mins}m</span>
                                        <span><MapPin size={8} style={{ display: 'inline', verticalAlign: 'middle' }} /> {a.distance_km}km</span>
                                        <span style={{ color: riskColor(a.composite_risk) }}>R:{Math.round(a.composite_risk * 100)}%</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#c0c0c0' }}>{a.quantity}</div>
                                    <div style={{ ...S.label, fontSize: 8 }}>{a.resource_type}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!lastOptimization && !loading && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#1a1a1a' }}>
                    <BarChart3 size={28} style={{ margin: '0 auto 8px', color: '#1a1a1a' }} />
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#2a2a2a', letterSpacing: '0.1em' }}>
                        SELECT SCENARIO → RUN OPTIMIZER
                    </div>
                </div>
            )}
        </div>
    );
}
