'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface ResourceGroup {
    type: string;
    available: number;
    deployed: number;
    transit: number;
}

interface Props {
    data: ResourceGroup[];
    view?: 'bar' | 'pie';
    height?: number;
}

const TYPE_COLORS: Record<string, string> = {
    truck: '#00d4ff',
    boat: '#a78bfa',
    medical: '#00e676',
    food: '#ffaa00',
};

const CHART_TOOLTIP = {
    contentStyle: {
        background: '#0d1520', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
    },
    labelStyle: { color: '#8a9bb0' },
};

export default function ResourceUtilChart({ data, view = 'bar', height = 200 }: Props) {
    if (!data.length) {
        return (
            <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5c6e', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                NO RESOURCE DATA
            </div>
        );
    }

    if (view === 'pie') {
        const pieData = data.map(d => ({
            name: d.type,
            value: d.deployed,
            color: TYPE_COLORS[d.type] || '#8a9bb0',
        }));

        return (
            <ResponsiveContainer width="100%" height={height}>
                <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}>
                        {pieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP} formatter={(val: number) => [`${val} units`]} />
                </PieChart>
            </ResponsiveContainer>
        );
    }

    // Stacked bar view
    const barData = data.map(d => ({
        name: d.type.charAt(0).toUpperCase() + d.type.slice(1),
        Available: d.available,
        Deployed: d.deployed,
        Transit: d.transit,
        color: TYPE_COLORS[d.type] || '#8a9bb0',
    }));

    const utilPercent = data.reduce((sum, d) => {
        const total = d.available + d.deployed + d.transit;
        return sum + (total > 0 ? (d.deployed / total) * 100 : 0);
    }, 0) / (data.length || 1);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: '#5a7fa6', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, textTransform: 'uppercase' }}>
          // Resource Utilization
                </span>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: utilPercent > 70 ? '#ff6b00' : '#00e676' }}>
                    {utilPercent.toFixed(0)}% deployed
                </span>
            </div>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: '#5a7fa6', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#5a7fa6', fontSize: 10 }} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
                    <Bar dataKey="Available" fill="#00e676" opacity={0.7} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Deployed" fill="#ff6b00" opacity={0.8} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Transit" fill="#ffaa00" opacity={0.6} radius={[2, 2, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
