import React from 'react'
import { useQuery, gql } from '@apollo/client'

const Q = gql`query GetFilesPerLodgement { filesPerLodgement { floor average ceiling } }`

const COLOR = '#2dd4bf'

export default function FilesPerLodgement() {
  const { data, loading, error } = useQuery(Q)
  if (loading) return <div className="loading">loading…</div>
  if (error) return <div className="error">error: {error.message}</div>

  const { floor, average, ceiling } = data.filesPerLodgement

  return (
    <div style={{
      background: '#12151e',
      border: `1px solid ${COLOR}44`,
      borderRadius: 10,
      padding: '20px 24px',
    }}>
      <div style={{
        fontSize: 10,
        fontFamily: 'DM Mono, monospace',
        color: COLOR,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 20,
      }}>
        Files attached per lodgement
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>floor</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e7f0', fontFamily: 'DM Mono, monospace' }}>{floor}</div>
        </div>

        <div style={{ color: '#252a38', fontSize: 20 }}>·</div>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>average</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f5c542', fontFamily: 'DM Mono, monospace', letterSpacing: '-0.5px' }}>
            {average.toFixed(1)}
          </div>
        </div>

        <div style={{ color: '#252a38', fontSize: 20 }}>·</div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>ceiling</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e7f0', fontFamily: 'DM Mono, monospace' }}>{ceiling}</div>
        </div>
      </div>
    </div>
  )
}
