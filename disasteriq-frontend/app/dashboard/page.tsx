'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    LogOut, RefreshCw, Bell, Map, BarChart3, AlertTriangle,
    TrendingUp, MessageSquare, BarChart2,
} from 'lucide-react';
import { useStore, SidebarTab } from '@/lib/store';
import { riskApi } from '@/lib/api';
import dynamic from 'next/dynamic';
import RiskInsightPanel from '@/components/panels/RiskInsightPanel';
import AllocationPanel from '@/components/panels/AllocationPanel';
import AlertsPanel from '@/components/panels/AlertsPanel';
import ReportsPanel from '@/components/panels/ReportsPanel';
import StatsPanel from '@/components/panels/StatsPanel';
import ComparePanel from '@/components/panels/ComparePanel';
import ChatPanel from '@/components/panels/ChatPanel';

const DisasterMap = dynamic(() => import('@/components/map/DisasterMap'), { ssr: false });

// All tabs — filtered by role below
const ALL_TABS: { id: SidebarTab; icon: any; label: string; roles?: string[] }[] = [
    { id: 'risk', icon: Map, label: 'Risk' },
    { id: 'relief', icon: BarChart3, label: 'Relief', roles: ['admin', 'officer'] },
    { id: 'alerts', icon: Bell, label: 'Alerts' },
    { id: 'reports', icon: AlertTriangle, label: 'Reports' },
    { id: 'stats', icon: TrendingUp, label: 'Stats' },
    { id: 'compare', icon: BarChart2, label: 'Compare' },
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
];

const ROLE_COLORS: Record<string, string> = {
    admin: 'tag tag-purple',
    officer: 'tag tag-cyan',
    ngo: 'tag tag-green',
};

export default function DashboardPage() {
    const router = useRouter();
    const {
        token, role, logout,
        districts, setDistricts,
        sidebarTab, setSidebarTab,
        setLoading,
    } = useStore();

    const [predicting, setPredicting] = useState(false);
    const [lastUpdate, setLastUpdate] = useState('');
    const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

    useEffect(() => {
        if (!token) { router.push('/auth/login'); return; }
        loadHeatmap();
        connectWebSocket();
    }, [token]);

    const loadHeatmap = async () => {
        setLoading(true);
        try {
            const data = await riskApi.getHeatmap();
            setDistricts(data);
            setLastUpdate(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
        } catch (err) { console.error('Heatmap load failed', err); }
        finally { setLoading(false); }
    };

    const connectWebSocket = () => {
        const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000') + '/ws/risk-updates';
        try {
            setWsStatus('connecting');
            const ws = new WebSocket(wsUrl);
            ws.onopen = () => setWsStatus('connected');
            ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.type === 'risk_update') loadHeatmap(); };
            ws.onclose = () => setWsStatus('disconnected');
            ws.onerror = () => setWsStatus('disconnected');
        } catch { setWsStatus('disconnected'); }
    };

    const runPrediction = async () => {
        setPredicting(true);
        try { await riskApi.predict(); await loadHeatmap(); }
        finally { setPredicting(false); }
    };

    const handleLogout = () => { logout(); router.push('/auth/login'); };

    const criticalCount = districts.filter(d => d.composite_risk > 0.8).length;
    const highRiskCount = districts.filter(d => d.composite_risk > 0.6).length;
    const totalAtRisk = districts.reduce((acc, d) => acc + (d.people_at_risk || 0), 0);

    const wsColor = wsStatus === 'connected' ? '#00e676' : wsStatus === 'connecting' ? '#ffaa00' : '#333';

    // Filter tabs by role
    const tabs = ALL_TABS.filter(t => !t.roles || t.roles.includes(role || ''));

    // Ensure current tab is accessible; if not, reset
    const validTab = tabs.some(t => t.id === sidebarTab) ? sidebarTab : 'risk';

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden' }}>

            {/* ── Navbar ─────────────────────────────────────── */}
            <nav style={{
                background: 'rgba(0,0,0,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '0 16px', height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0, zIndex: 10, backdropFilter: 'blur(8px)',
            }}>
                {/* Left: brand + critical badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, border: '1px solid rgba(0,212,255,0.5)', background: 'rgba(0,212,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: '#f0f0f0', letterSpacing: '0.05em' }}>CRISP</span>
                    </div>

                    <span style={{ color: '#1a1a1a', fontSize: 11 }}>|</span>

                    {criticalCount > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', background: 'rgba(255,59,59,0.1)', border: '1px solid rgba(255,59,59,0.3)' }}>
                            <span className="live-dot" style={{ width: 5, height: 5, background: '#ff3b3b', boxShadow: '0 0 6px #ff3b3b' }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#ff3b3b', letterSpacing: '0.1em' }}>{criticalCount} CRITICAL</span>
                        </div>
                    )}
                </div>

                {/* Centre: live stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <Stat label="HIGH-RISK" value={String(highRiskCount)} color="#ff6b00" />
                    <Stat label="AT RISK" value={`${(totalAtRisk / 1000).toFixed(0)}K`} color="#ffaa00" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: wsColor, boxShadow: wsStatus === 'connected' ? `0 0 6px ${wsColor}` : 'none', display: 'inline-block' }} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: wsColor, letterSpacing: '0.08em' }}>{wsStatus.toUpperCase()}</span>
                    </div>
                    {lastUpdate && (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#2a2a2a' }}>UPD {lastUpdate}</span>
                    )}
                </div>

                {/* Right: actions + role */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Only admin/officer can run predictions */}
                    {(role === 'admin' || role === 'officer') && (
                        <button
                            onClick={runPrediction}
                            disabled={predicting}
                            className="btn-ghost"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}
                        >
                            <RefreshCw size={11} style={{ animation: predicting ? 'spin 0.8s linear infinite' : 'none' }} />
                            {predicting ? 'COMPUTING...' : 'RUN PREDICT'}
                        </button>
                    )}

                    <span className={ROLE_COLORS[role || ''] || 'tag tag-cyan'} style={{ marginLeft: 4 }}>
                        {role}
                    </span>

                    <button onClick={handleLogout} title="Logout" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#333', padding: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ff3b3b')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#333')}
                    >
                        <LogOut size={14} />
                    </button>
                </div>
            </nav>

            {/* ── Main layout ────────────────────────────────── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* Map */}
                <div style={{ flex: 1, position: 'relative', background: '#000' }}>
                    <DisasterMap />
                </div>

                {/* Sidebar */}
                <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', width: 300, flexShrink: 0 }}>

                    {/* Tab nav — scrollable row */}
                    <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#000', flexShrink: 0, overflowX: 'auto' }}>
                        {tabs.map(({ id, icon: Icon, label }) => (
                            <button
                                key={id}
                                onClick={() => setSidebarTab(id)}
                                style={{
                                    flexShrink: 0, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', gap: 3, padding: '9px 10px',
                                    background: 'transparent', border: 'none',
                                    borderBottom: validTab === id ? '1px solid #00d4ff' : '1px solid transparent',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    fontSize: 8, letterSpacing: '0.08em',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    color: validTab === id ? '#00d4ff' : '#333',
                                    minWidth: 42,
                                }}
                            >
                                <Icon size={12} />
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Panel */}
                    <div style={{ flex: 1, overflowY: validTab === 'chat' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
                        {validTab === 'risk' && <RiskInsightPanel />}
                        {validTab === 'relief' && <AllocationPanel />}
                        {validTab === 'alerts' && <AlertsPanel />}
                        {validTab === 'reports' && <ReportsPanel />}
                        {validTab === 'stats' && <StatsPanel />}
                        {validTab === 'compare' && <ComparePanel />}
                        {validTab === 'chat' && <ChatPanel />}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color }}>{value}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#333', letterSpacing: '0.08em' }}>{label}</span>
        </div>
    );
}
