import React, { useState } from 'react'
import { useQuery, gql } from '@apollo/client'

const Q = gql`
  query GetLagOutliers {
    lagOutliers {
      fileName
      customerNumber
      fileCreator
      lagType
      lagSeconds
      zScore
    }
  }
`

const LABELS = {
  created_to_received:         'Created → Received',
  received_to_first_analysis:  'Received → 1st Analysis',
  received_to_second_analysis: 'Received → 2nd Analysis',
}

const COLORS = {
  created_to_received:         '#f5c542',
  received_to_first_analysis:  '#4f8ef5',
  received_to_second_analysis: '#a78bfa',
}

function fmt(seconds, lagType) {
  if (lagType === 'created_to_received') {
    const h = seconds / 3600
    if (h >= 24) return `${(h / 24).toFixed(1)}d`
    return `${h.toFixed(1)}h`
  }
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}m`
  return `${seconds.toFixed(2)}s`
}

const FILTERS = ['all', 'created_to_received', 'received_to_first_analysis', 'received_to_second_analysis']
const PAGE_SIZE = 15

export default function LagOutliers() {
  const { data, loading, error } = useQuery(Q)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)

  if (loading) return <div className="loading">loading…</div>
  if (error) return <div className="error">error: {error.message}</div>

  const filtered = filter === 'all'
    ? data.lagOutliers
    : data.lagOutliers.filter(r => r.lagType === filter)

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleFilter = (f) => { setFilter(f); setPage(0) }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: '#56607a', alignSelf: 'center' }}>
          {filtered.length} outliers (&gt;2σ)
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => handleFilter(f)} style={{
              background: filter === f ? '#252a38' : 'transparent',
              border: `1px solid ${filter === f ? (COLORS[f] ?? '#f5c542') : '#252a38'}`,
              color: filter === f ? (COLORS[f] ?? '#f5c542') : '#56607a',
              padding: '4px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'DM Mono, monospace',
            }}>
              {f === 'all' ? 'all' : LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File Name</th>
              <th>Customer</th>
              <th>Creator</th>
              <th>Lag Stage</th>
              <th>Lag Duration</th>
              <th style={{ color: '#f04f5a' }}>Z-Score</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i}>
                <td>{r.fileName}</td>
                <td>{r.customerNumber}</td>
                <td>{r.fileCreator}</td>
                <td>
                  <span style={{
                    color: COLORS[r.lagType],
                    fontWeight: 600,
                    fontSize: 11,
                  }}>
                    {LABELS[r.lagType]}
                  </span>
                </td>
                <td style={{ color: '#e4e7f0' }}>{fmt(r.lagSeconds, r.lagType)}</td>
                <td style={{ color: r.zScore < 0 ? '#3de89b' : '#f04f5a', fontWeight: 600 }}>
                  {r.zScore > 0 ? '+' : ''}{r.zScore.toFixed(2)}σ
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0}>← prev</button>
          <span>{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages - 1}>next →</button>
        </div>
      )}
    </div>
  )
}
