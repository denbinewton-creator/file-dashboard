import React from 'react'
import { useQuery, gql } from '@apollo/client'

const Q = gql`
  query GetFirstAnalysisResult {
    firstAnalysisResult {
      passedThisWeek
      passedThisYear
      failedThisWeek
      failedThisYear
    }
  }
`

function StatCard({ title, color, weekVal, yearVal, loading }) {
  const fmt = v => loading ? '—' : (v ?? 0).toLocaleString()
  return (
    <div style={{
      background: '#12151e',
      border: `1px solid ${color}44`,
      borderRadius: 10,
      padding: '20px 24px',
    }}>
      <div style={{
        fontSize: 10,
        fontFamily: 'DM Mono, monospace',
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 20,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>this week</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'DM Mono, monospace', letterSpacing: '-0.5px', color }}>
            {fmt(weekVal)}
          </div>
        </div>
        <div style={{ color: '#252a38', fontSize: 20 }}>·</div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>this year</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'DM Mono, monospace', letterSpacing: '-0.5px', color }}>
            {fmt(yearVal)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AnalysisResult() {
  const { data, loading } = useQuery(Q)
  const r = data?.firstAnalysisResult

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 14 }}>
      <StatCard title="First Analysis PASSED" color="var(--green)" weekVal={r?.passedThisWeek} yearVal={r?.passedThisYear} loading={loading} />
      <StatCard title="First Analysis FAILED" color="var(--red)"   weekVal={r?.failedThisWeek} yearVal={r?.failedThisYear} loading={loading} />
    </div>
  )
}
