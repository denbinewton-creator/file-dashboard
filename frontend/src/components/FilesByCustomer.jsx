import React from 'react'
import { useQuery, gql } from '@apollo/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'

const Q = gql`query GetFilesByCustomer { filesByCustomer { customerNumber count } }`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#181c27', border: '1px solid #252a38', borderRadius: 8, padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
      <div style={{ color: '#56607a', marginBottom: 4 }}>customer {label}</div>
      <div style={{ color: '#fb923c', fontWeight: 600 }}>{payload[0].value} files</div>
    </div>
  )
}

export default function FilesByCustomer() {
  const { data, loading, error } = useQuery(Q)
  if (loading) return <div className="loading">loading…</div>
  if (error) return <div className="error">error: {error.message}</div>

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data.filesByCustomer}
        layout="vertical"
        margin={{ top: 4, right: 50, left: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#252a38" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#56607a', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#252a38' }}
          label={{ value: 'number of files', position: 'insideBottom', offset: -2, fill: '#56607a', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
        />
        <YAxis
          dataKey="customerNumber"
          type="category"
          tick={{ fill: '#56607a', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="count" fill="#fb923c" radius={[0, 3, 3, 0]} maxBarSize={22}>
          <LabelList dataKey="count" position="right" style={{ fill: '#fb923c', fontSize: 11, fontFamily: 'DM Mono, monospace' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
