'use client';

import { useStore } from '@/lib/store';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';

const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };

interface Message {
    id: number;
    role: 'user' | 'assistant';
    text: string;
    ts: string;
}

/* ── Rule-based query engine (no backend needed) ─────────────── */
function queryDistricts(input: string, districts: any[]): string {
    const q = input.toLowerCase();

    // Critical districts
    if (q.includes('critical') || q.includes('most dangerous') || q.includes('highest risk')) {
        const top = [...districts].sort((a, b) => b.composite_risk - a.composite_risk).slice(0, 5);
        if (!top.length) return 'No district data loaded yet.';
        return `TOP CRITICAL DISTRICTS:\n${top.map((d, i) =>
            `${String(i + 1).padStart(2, '0')}. ${d.name}, ${d.state} — ${Math.round(d.composite_risk * 100)}% risk`
        ).join('\n')}`;
    }

    // Flood risk
    if (q.includes('flood')) {
        const top = [...districts].sort((a, b) => b.flood_risk - a.flood_risk).slice(0, 5);
        return `HIGHEST FLOOD RISK:\n${top.map((d, i) =>
            `${String(i + 1).padStart(2, '0')}. ${d.name}, ${d.state} — ${Math.round(d.flood_risk * 100)}%`
        ).join('\n')}`;
    }

    // Cyclone risk
    if (q.includes('cyclone') || q.includes('storm')) {
        const top = [...districts].sort((a, b) => b.cyclone_risk - a.cyclone_risk).slice(0, 5);
        return `HIGHEST CYCLONE RISK:\n${top.map((d, i) =>
            `${String(i + 1).padStart(2, '0')}. ${d.name}, ${d.state} — ${Math.round(d.cyclone_risk * 100)}%`
        ).join('\n')}`;
    }

    // Heatwave
    if (q.includes('heat') || q.includes('heatwave') || q.includes('temperature')) {
        const top = [...districts].sort((a, b) => b.heatwave_risk - a.heatwave_risk).slice(0, 5);
        return `HIGHEST HEATWAVE RISK:\n${top.map((d, i) =>
            `${String(i + 1).padStart(2, '0')}. ${d.name}, ${d.state} — ${Math.round(d.heatwave_risk * 100)}%`
        ).join('\n')}`;
    }

    // People at risk
    if (q.includes('people') || q.includes('population') || q.includes('at risk')) {
        const total = districts.reduce((a, d) => a + (d.people_at_risk || 0), 0);
        const top = [...districts].sort((a, b) => b.people_at_risk - a.people_at_risk).slice(0, 3);
        return `TOTAL PEOPLE AT RISK: ${total.toLocaleString()}\n\nHIGHEST AFFECTED:\n${top.map((d, i) =>
            `${String(i + 1).padStart(2, '0')}. ${d.name} — ${(d.people_at_risk || 0).toLocaleString()} at risk`
        ).join('\n')}`;
    }

    // State-specific
    const stateMatch = districts.find(d => q.includes(d.state.toLowerCase()));
    if (stateMatch) {
        const stateDistricts = districts.filter(d => d.state === stateMatch.state);
        const highest = stateDistricts.sort((a, b) => b.composite_risk - a.composite_risk)[0];
        const avgRisk = stateDistricts.reduce((a, d) => a + d.composite_risk, 0) / stateDistricts.length;
        return `${stateMatch.state.toUpperCase()} STATUS:\n` +
            `Districts: ${stateDistricts.length}\n` +
            `Avg Risk: ${Math.round(avgRisk * 100)}%\n` +
            `Highest Risk: ${highest.name} (${Math.round(highest.composite_risk * 100)}%)`;
    }

    // District-specific
    const districtMatch = districts.find(d => q.includes(d.name.toLowerCase()));
    if (districtMatch) {
        const d = districtMatch;
        return `${d.name.toUpperCase()}, ${d.state}\n` +
            `Composite Risk: ${Math.round(d.composite_risk * 100)}%\n` +
            `Flood: ${Math.round(d.flood_risk * 100)}% | Cyclone: ${Math.round(d.cyclone_risk * 100)}% | Heat: ${Math.round(d.heatwave_risk * 100)}%\n` +
            `People At Risk: ${(d.people_at_risk || 0).toLocaleString()}\n` +
            `Confidence: ${Math.round((d.confidence || 0) * 100)}%`;
    }

    // Safe / low risk
    if (q.includes('safe') || q.includes('low risk') || q.includes('minimal')) {
        const safe = [...districts].sort((a, b) => a.composite_risk - b.composite_risk).slice(0, 5);
        return `LOWEST RISK DISTRICTS:\n${safe.map((d, i) =>
            `${String(i + 1).padStart(2, '0')}. ${d.name}, ${d.state} — ${Math.round(d.composite_risk * 100)}%`
        ).join('\n')}`;
    }

    // Summary
    if (q.includes('summary') || q.includes('overview') || q.includes('status') || q.includes('report')) {
        const total = districts.length;
        const critical = districts.filter(d => d.composite_risk > 0.8).length;
        const high = districts.filter(d => d.composite_risk > 0.6 && d.composite_risk <= 0.8).length;
        const atRisk = districts.reduce((a, d) => a + (d.people_at_risk || 0), 0);
        return `INDIA RISK SUMMARY\n` +
            `Districts Monitored: ${total}\n` +
            `CRITICAL: ${critical} | HIGH: ${high}\n` +
            `Total At Risk: ${(atRisk / 1e6).toFixed(1)}M people\n` +
            `Data updated: ${new Date().toLocaleTimeString('en-IN')}`;
    }

    // Help
    return `CRISP INTELLIGENCE ENGINE\n\nTry asking:\n` +
        `• "Which districts are critical?"\n` +
        `• "Show flood risk"\n` +
        `• "Cyclone risk top 5"\n` +
        `• "People at risk"\n` +
        `• "Summary of India"\n` +
        `• "Status of Odisha"\n` +
        `• "Is Puri safe?"`;
}

const QUICK_QUERIES = [
    'Critical districts',
    'Top flood risk',
    'Cyclone danger zones',
    'India summary',
    'People at risk',
    'Safe districts',
];

let idCounter = 0;

export default function ChatPanel() {
    const { districts } = useStore();
    const [messages, setMessages] = useState<Message[]>([{
        id: 0, role: 'assistant', ts: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        text: 'CRISP INTELLIGENCE ONLINE\n\nAsk me about disaster risk across India. Type a query or use a quick command below.',
    }]);
    const [input, setInput] = useState('');
    const [thinking, setThinking] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = async (text: string) => {
        if (!text.trim()) return;
        const userMsg: Message = { id: ++idCounter, role: 'user', text: text.trim(), ts: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setThinking(true);

        // Simulate brief thinking delay, then query
        await new Promise(r => setTimeout(r, 400));
        const answer = queryDistricts(text, districts);
        const botMsg: Message = { id: ++idCounter, role: 'assistant', text: answer, ts: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
        setMessages(prev => [...prev, botMsg]);
        setThinking(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>

            {/* Header */}
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 6px #00e676', animation: 'live-pulse 2s ease-in-out infinite' }} />
                    <div style={{ ...MONO, fontSize: 11, fontWeight: 600, color: '#f0f0f0' }}>AI Risk Query</div>
                </div>
                <div style={{ ...MONO, fontSize: 9, color: '#333', letterSpacing: '0.1em', marginTop: 2 }}>
                    CRISP INTELLIGENCE ENGINE · {districts.length} DISTRICTS LOADED
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map(m => (
                    <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        {m.role === 'assistant' && (
                            <div style={{ width: 22, height: 22, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                <Bot size={11} color="#00d4ff" />
                            </div>
                        )}
                        <div style={{
                            maxWidth: '80%',
                            background: m.role === 'user' ? 'rgba(0,212,255,0.07)' : '#080808',
                            border: `1px solid ${m.role === 'user' ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
                            padding: '8px 10px',
                        }}>
                            <div style={{ ...MONO, fontSize: 10, color: m.role === 'user' ? '#00d4ff' : '#aaa', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {m.text}
                            </div>
                            <div style={{ ...MONO, fontSize: 8, color: '#2a2a2a', marginTop: 4 }}>{m.ts}</div>
                        </div>
                        {m.role === 'user' && (
                            <div style={{ width: 22, height: 22, background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                <User size={11} color="#444" />
                            </div>
                        )}
                    </div>
                ))}

                {thinking && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ width: 22, height: 22, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Bot size={11} color="#00d4ff" />
                        </div>
                        <div style={{ background: '#080808', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#00d4ff', animation: `blink 1s step-end ${i * 0.3}s infinite` }} />
                            ))}
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Quick queries */}
            <div style={{ padding: '6px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
                {QUICK_QUERIES.map(q => (
                    <button
                        key={q}
                        onClick={() => send(q)}
                        style={{
                            ...MONO, fontSize: 8, padding: '3px 8px', letterSpacing: '0.06em',
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
                            color: '#444', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,212,255,0.3)'; (e.currentTarget as HTMLButtonElement).style.color = '#00d4ff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#444'; }}
                    >
                        {q}
                    </button>
                ))}
            </div>

            {/* Input */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 6, flexShrink: 0 }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') send(input); }}
                    placeholder="Ask about risk data..."
                    style={{
                        flex: 1, padding: '8px 10px', background: '#000',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#c0c0c0', outline: 'none',
                        ...MONO, fontSize: 10,
                    }}
                />
                <button
                    onClick={() => send(input)}
                    disabled={!input.trim() || thinking}
                    style={{
                        padding: '8px 12px', background: input.trim() ? '#00d4ff' : 'transparent',
                        border: '1px solid rgba(0,212,255,0.3)', color: input.trim() ? '#000' : '#333',
                        cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center',
                        transition: 'all 0.15s',
                    }}
                >
                    <Send size={12} />
                </button>
            </div>
        </div>
    );
}
