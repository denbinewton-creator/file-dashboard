import React, { useState } from 'react'
import { useQuery, gql } from '@apollo/client'

const Q = gql`
  query {
    overdueFiles {
      fileId
      fileCreatedAt
      disposalTime
      disposalDate
      daysOverdue
    }
  }
`

const PAGE_SIZE = 20

export default function OverdueFilesTable() {
  const { data, loading, error } = useQuery(Q)
  const [page, setPage] = useState(0)

  if (loading) return <div className="loading">loading…</div>
  if (error) return <div className="error">error: {error.message}</div>

  const files = data.overdueFiles
  const totalPages = Math.ceil(files.length / PAGE_SIZE)
  const slice = files.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div>
      <div className="overdue-meta">
        <span>{files.length}</span> files past their disposal date · sorted by most overdue
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Created</th>
              <th>Retention</th>
              <th>Disposal Date</th>
              <th style={{ color: 'var(--red)' }}>Days Overdue</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((f, i) => (
              <tr key={i}>
                <td>{f.fileId}</td>
                <td>{f.fileCreatedAt}</td>
                <td>{f.disposalTime}</td>
                <td>{f.disposalDate}</td>
                <td className="overdue-days">{f.daysOverdue.toLocaleString()}</td>
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
