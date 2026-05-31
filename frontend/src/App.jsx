import React, { useState, useEffect } from 'react'
import { ApolloProvider, useQuery, gql, useApolloClient } from '@apollo/client'
import client from './apolloClient'
import About from './pages/About'
import Synopsis from './pages/Synopsis'
import OverdueFilesTable from './components/OverdueFilesTable'
import FileCategoryPie from './components/FileCategoryPie'
import DirectionPie from './components/DirectionPie'
import CustomerTypePie from './components/CustomerTypePie'
import LagStats from './components/LagStats'
import RecentFileCounts from './components/RecentFileCounts'
import AnalysisResult from './components/AnalysisResult'

const KPI_QUERY = gql`
  query GetKPIs {
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

// Refetches all active queries every 20s to pick up BAU inserts
function AutoRefresh() {
  const apollo = useApolloClient()
  useEffect(() => {
    const id = setInterval(() => apollo.refetchQueries({ include: 'active' }), 20000)
    return () => clearInterval(id)
  }, [apollo])
  return null
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'about',     label: 'About' },
  { id: 'synopsis',  label: 'Synopsis' },
]

export default function App() {
  const [page, setPage] = useState('about')

  return (
    <ApolloProvider client={client}>
      <div className="dashboard">
        <header className="dashboard-header">
          <h1>File <span>Repository</span> Dashboard</h1>
          <span className="header-sub">1 000 records · live via GraphQL</span>
          <nav style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setPage(item.id)} style={{
                background:    page === item.id ? '#252a38' : 'transparent',
                border:        `1px solid ${page === item.id ? 'var(--accent)' : 'var(--border)'}`,
                color:         page === item.id ? 'var(--accent)' : 'var(--muted)',
                padding:       '6px 18px',
                borderRadius:  6,
                cursor:        'pointer',
                fontFamily:    'DM Mono, monospace',
                fontSize:      12,
                fontWeight:    page === item.id ? 600 : 400,
                letterSpacing: '0.05em',
              }}>
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <AutoRefresh />
        {page === 'about'    ? <About />    : null}
        {page === 'synopsis' ? <Synopsis /> : null}
        {page === 'dashboard' ? <KPIBar /> : null}
        {page === 'dashboard' ? <AnalysisResult /> : null}
        {page === 'dashboard' ? <RecentFileCounts /> : null}

        {page === 'dashboard' && <div className="dashboard-grid">
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


        </div>}
      </div>
    </ApolloProvider>
  )
}
