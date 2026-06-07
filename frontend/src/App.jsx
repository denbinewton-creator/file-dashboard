import React, { useState, useEffect } from 'react'
import { ApolloProvider, useApolloClient } from '@apollo/client'
import client from './apolloClient'
import About from './pages/About'
import Synopsis from './pages/Synopsis'
import FileDashboard from './pages/FileDashboard'
import LodgementDashboard from './pages/LodgementDashboard'

// Refetches all active queries every 20s to pick up BAU inserts.
// include: 'active' limits refetch to queries mounted in the current page —
// switching to About/Synopsis stops unnecessary network calls.
function AutoRefresh() {
  const apollo = useApolloClient()
  useEffect(() => {
    const id = setInterval(() => apollo.refetchQueries({ include: 'active' }), 20000)
    return () => clearInterval(id)
  }, [apollo])
  return null
}

const NAV_ITEMS = [
  { id: 'file-dashboard',      label: 'File Dashboard' },
  { id: 'lodgement-dashboard', label: 'Lodgement Dashboard' },
  { id: 'about',               label: 'About' },
  { id: 'synopsis',            label: 'Synopsis' },
]

export default function App() {
  const [page, setPage] = useState('about')

  return (
    <ApolloProvider client={client}>
      <div className="dashboard">
        <header className="dashboard-header">
          <h1>PoC <span>statistics</span> observability</h1>
          <span className="header-sub">live via GraphQL</span>
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
        {page === 'about'               && <About />}
        {page === 'synopsis'            && <Synopsis />}
        {page === 'file-dashboard'      && <FileDashboard />}
        {page === 'lodgement-dashboard' && <LodgementDashboard />}
      </div>
    </ApolloProvider>
  )
}
