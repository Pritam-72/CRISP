'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

interface DataPoint {
    time: string;
    flood_risk: number;
    heatwave_risk: number;
    cyclone_risk: number;
    composite_risk: number;
}

interface Props {
    data: DataPoint[];
    title?: string;
    height?: number;
}

const CHART_TOOLTIP = {
    contentStyle: {
        background: '#0d1520', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
    },
    labelStyle: { color: '#8a9bb0', marginBottom: 4 },
    itemStyle: { color: '#e0e8f0' },
};

export default function RiskTrendChart({ data, title = 'Risk Trend (72h)', height = 220 }: Props) {
    const chartData = data.map(d => ({
        t: new Date(d.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        Composite: Math.round(d.composite_risk * 100),
        Flood: Math.round(d.flood_risk * 100),
        Heatwave: Math.round(d.heatwave_risk * 100),
        Cyclone: Math.round(d.cyclone_risk * 100),
    }));

    return (
        <div>
            {title && (
                <div style={{ fontSize: 11, color: '#5a7fa6', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
          // {title}
                </div>
            )}
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="t" tick={{ fill: '#5a7fa6', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fill: '#5a7fa6', fontSize: 10 }} unit="%" />
                    <Tooltip {...CHART_TOOLTIP} formatter={(val: number) => [`${val}%`]} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
                    <Line type="monotone" dataKey="Composite" stroke="#00d4ff" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Flood" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="Heatwave" stroke="#ffaa00" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="Cyclone" stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
