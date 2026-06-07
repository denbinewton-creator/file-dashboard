import React from 'react'
import { useQuery, gql } from '@apollo/client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const Q = gql`query GetLodgementsByStatus { lodgementsByStatus { status count } }`

const COLORS = ['#3de89b', '#f5c542', '#f04f5a']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#181c27', border: '1px solid #252a38', borderRadius: 8, padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
      <div style={{ color: payload[0].payload.fill, fontWeight: 600, marginBottom: 2 }}>{payload[0].name}</div>
      <div style={{ color: '#e4e7f0' }}>{payload[0].value} lodgements</div>
    </div>
  )
}

const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function LodgementByStatusPie() {
  const { data, loading, error } = useQuery(Q)
  if (loading) return <div className="loading">loading…</div>
  if (error) return <div className="error">error: {error.message}</div>

  const chartData = data.lodgementsByStatus.map((d, i) => ({ ...d, name: d.status, fill: COLORS[i % COLORS.length] }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={chartData} dataKey="count" nameKey="name" cx="50%" cy="50%"
          outerRadius={100} labelLine={false} label={renderLabel}>
          {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={(v) => <span style={{ color: '#56607a', fontSize: 12, fontFamily: 'DM Mono, monospace' }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}
