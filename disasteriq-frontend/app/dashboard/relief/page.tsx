'use client';
import { useEffect, useState } from 'react';
import { reliefApi } from '@/lib/api';

export default function ReliefPage() {
    const [resources, setResources] = useState<any[]>([]);
    const [allocations, setAllocations] = useState<any[]>([]);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        reliefApi.getResources().then(setResources).catch(() => { });
        reliefApi.getAllocations().then(setAllocations).catch(() => { });
    }, []);

    async function runOptimization() {
        setRunning(true);
        try {
            const r = await reliefApi.optimize();
            setResult(r);
            const updated = await reliefApi.getAllocations();
            setAllocations(updated);
        } catch (e: any) {
            setResult({ error: e.message });
        } finally {
            setRunning(false);
        }
    }

    const S = {
        card: {
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: 20,
        } as React.CSSProperties,
        label: { fontSize: 11, color: '#5a7fa6', textTransform: 'uppercase' as const, letterSpacing: 1, fontFamily: "'JetBrains Mono', monospace" },
    };

    const resourceTypes = ['truck', 'boat', 'medical', 'food'];
    const resourceGroups = resourceTypes.reduce((acc: any, t) => {
        acc[t] = resources.filter(r => r.type === t);
        return acc;
    }, {});

    return (
        <div style={{ minHeight: '100vh', background: '#080c14', padding: 24, fontFamily: "'Inter', sans-serif", color: '#e0e8f0' }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Allocation Simulator</h1>
                    <p style={{ color: '#5a7fa6', fontSize: 13, margin: '6px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
                        OR-Tools VRP · Multi-objective optimization (time + cost + equity)
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                    {/* Resource Inventory */}
                    <div style={S.card}>
                        <div style={{ ...S.label, marginBottom: 16 }}>Resource Inventory</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {resourceTypes.map(type => {
                                const items = resourceGroups[type] || [];
                                const avail = items.filter((r: any) => r.status === 'available').reduce((s: number, r: any) => s + r.quantity, 0);
                                const deployed = items.filter((r: any) => r.status === 'deployed').reduce((s: number, r: any) => s + r.quantity, 0);
                                const icons: Record<string, string> = { truck: '🚛', boat: '🚤', medical: '🏥', food: '🍱' };
                                return (
                                    <div key={type} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 14 }}>
                                        <div style={{ fontSize: 20, marginBottom: 6 }}>{icons[type]}</div>
                                        <div style={{ fontSize: 11, textTransform: 'capitalize' as const, color: '#8a9bb0', marginBottom: 4 }}>{type}</div>
                                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: '#00e676' }}>{avail}</div>
                                        <div style={{ fontSize: 11, color: '#4a5c6e' }}>avail · <span style={{ color: '#ff6b00' }}>{deployed}</span> deployed</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Optimization Controls */}
                    <div style={S.card}>
                        <div style={{ ...S.label, marginBottom: 16 }}>Run Optimization</div>
                        <p style={{ color: '#8a9bb0', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                            Solves the Vehicle Routing Problem across all high-risk districts.
                            Uses equity weighting (vulnerability_weight) to ensure remote districts are not ignored.
                        </p>
                        {result?.error && (
                            <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#ff6b6b', fontSize: 13 }}>
                                ⚠️ {result.error}
                            </div>
                        )}
                        {result && !result.error && (
                            <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#00e676', fontSize: 13 }}>
                                ✅ Optimization complete · {result.total_allocations ?? result.allocations?.length ?? 0} routes generated
                            </div>
                        )}
                        <button id="run-optimization" onClick={runOptimization} disabled={running} style={{
                            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                            background: running ? 'rgba(0,212,255,0.2)' : 'linear-gradient(135deg, #00d4ff22, #0088ff44)',
                            color: running ? '#5a7fa6' : '#00d4ff', fontWeight: 600, fontSize: 14, cursor: running ? 'not-allowed' : 'pointer',
                            border: '1px solid rgba(0,212,255,0.3)' as any,
                        }}>
                            {running ? '⏳ Solving VRP...' : '⚡ Run Optimization'}
                        </button>
                    </div>
                </div>

                {/* Allocation Results */}
                <div style={S.card}>
                    <div style={{ ...S.label, marginBottom: 16 }}>Active Allocations ({allocations.length})</div>
                    {allocations.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#4a5c6e', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                            NO ALLOCATIONS — RUN OPTIMIZATION TO GENERATE ROUTES
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {allocations.slice(0, 20).map((a: any, i: number) => (
                                <div key={a.id || i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                    <div>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>District #{a.district_id}</span>
                                        <span style={{ margin: '0 8px', color: '#3a4a5a' }}>·</span>
                                        <span style={{ fontSize: 12, color: '#8a9bb0', textTransform: 'capitalize' }}>{a.resource_type}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#00e676' }}>×{a.quantity_allocated}</span>
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#ffaa00' }}>
                                            ~{a.estimated_arrival_mins ?? '?'} min
                                        </span>
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#4a5c6e' }}>
                                            score: {(a.optimization_score ?? 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
