import React from 'react'
import { useQuery, gql } from '@apollo/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const Q = gql`query GetFilesTimeline { filesTimeline { period count } }`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#181c27', border: '1px solid #252a38', borderRadius: 8, padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
      <div style={{ color: '#56607a', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#f5c542', fontWeight: 600 }}>{payload[0].value} files</div>
    </div>
  )
}

export default function FilesTimeline() {
  const { data, loading, error } = useQuery(Q)
  if (loading) return <div className="loading">loading…</div>
  if (error) return <div className="error">error: {error.message}</div>

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data.filesTimeline} margin={{ top: 4, right: 16, left: -10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#252a38" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fill: '#56607a', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
          angle={-55}
          textAnchor="end"
          interval={1}
          tickLine={false}
          axisLine={{ stroke: '#252a38' }}
        />
        <YAxis
          tick={{ fill: '#56607a', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="count" fill="#f5c542" radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
