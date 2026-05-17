import React from 'react'
import { useQuery, gql } from '@apollo/client'

const Q = gql`
  query {
    customerCreatorRelation {
      customerNumber
      fileCreator
      count
    }
  }
`

function heatColor(count, max) {
  if (!count) return { bg: '#12151e', text: '#252a38' }
  const t = Math.min(count / max, 1)
  // dark background: interpolate from surface (#12151e) toward accent (#f5c542)
  const r = Math.round(18 + (245 - 18) * t)
  const g = Math.round(21 + (197 - 21) * t)
  const b = Math.round(30 + (66 - 30) * t)
  const textLight = t > 0.55
  return {
    bg: `rgb(${r},${g},${b})`,
    text: textLight ? '#0b0d12' : '#e4e7f0',
  }
}

export default function CustomerCreatorHeatmap() {
  const { data, loading, error } = useQuery(Q)
  if (loading) return <div className="loading">loading…</div>
  if (error) return <div className="error">error: {error.message}</div>

  const relations = data.customerCreatorRelation
  const customers = [...new Set(relations.map(r => r.customerNumber))].sort()
  const creators  = [...new Set(relations.map(r => r.fileCreator))].sort()

  const lookup = {}
  relations.forEach(r => { lookup[`${r.customerNumber}:${r.fileCreator}`] = r.count })
  const maxCount = Math.max(...relations.map(r => r.count))

  return (
    <div>
      <div className="heatmap-wrap">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th className="row-header">customer ╲ creator</th>
              {creators.map(c => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {customers.map(customer => (
              <tr key={customer}>
                <th className="row-header" style={{ textAlign: 'left' }}>{customer}</th>
                {creators.map(creator => {
                  const count = lookup[`${customer}:${creator}`] || 0
                  const { bg, text } = heatColor(count, maxCount)
                  return (
                    <td key={creator} title={count ? `${count} files` : '—'} style={{ background: bg, color: text, fontWeight: count ? 600 : 400 }}>
                      {count || ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heatmap-legend">
        cells show file count · color intensity = volume · max in dataset: {maxCount}
      </div>
    </div>
  )
}
