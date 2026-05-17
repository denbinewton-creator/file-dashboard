import React from 'react'
import { useQuery, gql } from '@apollo/client'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

const Q = gql`query GetDisposalTimeline { disposalTimeline { year count } }`

const TODAY_YEAR = String(new Date().getFullYear())

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const isPast = label < TODAY_YEAR
  return (
    <div style={{ background: '#181c27', border: '1px solid #252a38', borderRadius: 8, padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
      <div style={{ color: '#56607a', marginBottom: 4 }}>{label} {isPast ? '(past)' : '(upcoming)'}</div>
      <div style={{ color: '#2dd4bf', fontWeight: 600 }}>{payload[0].value} files due</div>
    </div>
  )
}

export default function DisposalTimeline() {
  const { data, loading, error } = useQuery(Q)
  if (loading) return <div className="loading">loading…</div>
  if (error) return <div className="error">error: {error.message}</div>

  const chartData = data.disposalTimeline.map(d => ({
    ...d,
    fill: d.year <= TODAY_YEAR ? '#f04f5a' : '#2dd4bf',
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 16, right: 24, left: -10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#252a38" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fill: '#56607a', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#252a38' }}
        />
        <YAxis
          tick={{ fill: '#56607a', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <ReferenceLine
          x={TODAY_YEAR}
          stroke="#f04f5a"
          strokeWidth={2}
          strokeDasharray="6 3"
          label={{ value: 'TODAY', position: 'top', fill: '#f04f5a', fontSize: 11, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={36}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.year <= TODAY_YEAR ? '#f04f5a' : '#2dd4bf'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
