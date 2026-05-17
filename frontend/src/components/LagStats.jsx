import React from 'react'
import { useQuery, gql } from '@apollo/client'

const Q = gql`query GetLagStats { lagStats { lagType avgSeconds minSeconds maxSeconds p95Seconds } }`

const LABELS = {
  received_to_first_analysis:  'Received → 1st Analysis',
  received_to_second_analysis: 'Received → 2nd Analysis',
}

const COLORS = {
  received_to_first_analysis:  '#4f8ef5',
  received_to_second_analysis: '#a78bfa',
}

function fmt(seconds) {
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}m`
  return `${seconds.toFixed(2)}s`
}

export default function LagStats() {
  const { data, loading, error } = useQuery(Q)
  if (loading) return <div className="loading">loading…</div>
  if (error) return <div className="error">error: {error.message}</div>

  const visible = data.lagStats.filter(d => d.lagType !== 'created_to_received')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
      {visible.map(d => (
        <div key={d.lagType} style={{
          background: '#12151e',
          border: `1px solid ${COLORS[d.lagType]}44`,
          borderRadius: 10,
          padding: '20px 24px',
        }}>
          <div style={{
            fontSize: 10,
            fontFamily: 'DM Mono, monospace',
            color: COLORS[d.lagType],
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 20,
          }}>
            {LABELS[d.lagType]}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>

            {/* Floor */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>floor</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e7f0', fontFamily: 'DM Mono, monospace' }}>
                {fmt(d.minSeconds)}
              </div>
            </div>

            <div style={{ color: '#252a38', fontSize: 20 }}>·</div>

            {/* Average */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>average</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f5c542', fontFamily: 'DM Mono, monospace', letterSpacing: '-0.5px' }}>
                {fmt(d.avgSeconds)}
              </div>
            </div>

            <div style={{ color: '#252a38', fontSize: 20 }}>·</div>

            {/* Ceiling */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>ceiling</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e7f0', fontFamily: 'DM Mono, monospace' }}>
                {fmt(d.maxSeconds)}
              </div>
            </div>

          </div>
        </div>
      ))}
    </div>
  )
}
