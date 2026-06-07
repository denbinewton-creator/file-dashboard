import React from 'react'
import { useQuery, gql } from '@apollo/client'
import LodgementByEnginePie from '../components/LodgementByEnginePie'
import LodgementByStatusPie from '../components/LodgementByStatusPie'
import LodgementByIngressPie from '../components/LodgementByIngressPie'
import FilesPerLodgement from '../components/FilesPerLodgement'

const KPI_QUERY = gql`query GetLodgementKPI { totalLodgements }`

function LodgementKPI() {
  const { data } = useQuery(KPI_QUERY)
  const total = data ? data.totalLodgements : '—'
  return (
    <div className="kpis" style={{ gridTemplateColumns: 'repeat(1, 1fr)' }}>
      <div className="kpi-card">
        <div className="kpi-label">Total Lodgements</div>
        <div className="kpi-value" style={{ color: 'var(--accent)' }}>{total.toLocaleString?.() ?? total}</div>
      </div>
    </div>
  )
}

export default function LodgementDashboard() {
  return (
    <>
      <LodgementKPI />

      <div className="dashboard-grid">
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <div className="chart-card">
            <h2><span className="dot" style={{ background: 'var(--green)' }} />By Processing Engine</h2>
            <LodgementByEnginePie />
          </div>
          <div className="chart-card">
            <h2><span className="dot" style={{ background: 'var(--accent)' }} />By Lodgement Status</h2>
            <LodgementByStatusPie />
          </div>
          <div className="chart-card">
            <h2><span className="dot" style={{ background: 'var(--blue)' }} />By Ingress Location</h2>
            <LodgementByIngressPie />
          </div>
        </div>

        <div className="chart-card full-width">
          <h2><span className="dot" style={{ background: 'var(--teal)' }} />Files per Lodgement — Floor, Average &amp; Ceiling</h2>
          <FilesPerLodgement />
        </div>
      </div>
    </>
  )
}
