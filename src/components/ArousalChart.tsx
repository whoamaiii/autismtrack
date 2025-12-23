import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { LogEntry } from '../types';
import { format } from 'date-fns';

interface ArousalChartProps {
    logs: LogEntry[];
}

export const ArousalChart: React.FC<ArousalChartProps> = ({ logs }) => {
    // Sort logs by timestamp
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const data = sortedLogs.map(log => ({
        time: new Date(log.timestamp).getTime(),
        arousal: log.arousal,
        formattedTime: format(new Date(log.timestamp), 'HH:mm'),
    }));

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-slate-400">
                No data available for this period
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%" minHeight={150}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorArousal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4c8dff" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#4c8dff" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                <XAxis
                    dataKey="formattedTime"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    domain={[0, 10]}
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip
                    contentStyle={{ backgroundColor: '#0d111c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                />
                <Area
                    type="monotone"
                    dataKey="arousal"
                    stroke="#4c8dff"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorArousal)"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};
