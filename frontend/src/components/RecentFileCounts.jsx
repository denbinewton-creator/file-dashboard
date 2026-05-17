import React from 'react'
import { useQuery, gql } from '@apollo/client'

const Q = gql`
  query GetRecentFileCounts {
    recentFileCounts {
      thisHour
      thisWeek
      thisYear
    }
  }
`

const STATS = [
  { key: 'thisHour', label: 'Files Received This Hour', color: 'var(--teal)' },
  { key: 'thisWeek', label: 'Files Received This Week', color: 'var(--blue)' },
  { key: 'thisYear', label: 'Files Received This Year', color: 'var(--purple)' },
]

export default function RecentFileCounts() {
  const { data, loading } = useQuery(Q)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
      {STATS.map(({ key, label, color }) => (
        <div key={key} className="kpi-card" style={{ borderColor: `${color}33` }}>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value" style={{ color }}>
            {loading ? '—' : (data?.recentFileCounts?.[key] ?? 0).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
