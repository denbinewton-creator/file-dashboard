import React from 'react'
import { useQuery, gql } from '@apollo/client'
import OverdueFilesTable from '../components/OverdueFilesTable'
import FileCategoryPie from '../components/FileCategoryPie'
import DirectionPie from '../components/DirectionPie'
import CustomerTypePie from '../components/CustomerTypePie'
import LagStats from '../components/LagStats'
import RecentFileCounts from '../components/RecentFileCounts'
import AnalysisResult from '../components/AnalysisResult'

const KPI_QUERY = gql`
  query GetFileKPIs {
    overdueFiles { daysOverdue }
    filesByCategory { count }
  }
`

function KPIBar() {
  const { data } = useQuery(KPI_QUERY)
  const total = data ? data.filesByCategory.reduce((s, c) => s + c.count, 0) : '—'
  const overdue = data ? data.overdueFiles.length : '—'

  return (
    <div className="kpis">
      <div className="kpi-card">
        <div className="kpi-label">Total Files</div>
        <div className="kpi-value" style={{ color: 'var(--accent)' }}>{total.toLocaleString?.() ?? total}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Overdue for Disposal</div>
        <div className="kpi-value" style={{ color: 'var(--red)' }}>{overdue.toLocaleString?.() ?? overdue}</div>
      </div>
    </div>
  )
}

export default function FileDashboard() {
  return (
    <>
      <KPIBar />
      <AnalysisResult />
      <RecentFileCounts />

      <div className="dashboard-grid">
        <div className="chart-card full-width">
          <h2><span className="dot" style={{ background: 'var(--teal)' }} />Processing Lag — Average &amp; P95 per Stage</h2>
          <LagStats />
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <div className="chart-card">
            <h2><span className="dot" style={{ background: 'var(--blue)' }} />File Category Spread</h2>
            <FileCategoryPie />
          </div>
          <div className="chart-card">
            <h2><span className="dot" style={{ background: 'var(--teal)' }} />Files by Direction</h2>
            <DirectionPie />
          </div>
          <div className="chart-card">
            <h2><span className="dot" style={{ background: 'var(--purple)' }} />Files by Customer Type</h2>
            <CustomerTypePie />
          </div>
        </div>

        <div className="chart-card full-width">
          <h2><span className="dot" style={{ background: 'var(--red)' }} />Files Overdue for Disposal</h2>
          <OverdueFilesTable />
        </div>
      </div>
    </>
  )
}
