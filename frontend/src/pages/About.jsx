import React from 'react'

const DATA_MODEL = {
  customer_number:             { type: 'string', constraint: '9 digits' },
  customer_type:               { type: 'string', constraint: 'type_1 | type_2 | type_3' },
  file_name:                   { type: 'string', constraint: 'min 2 words · .pdf .jpeg .docx .xlsx' },
  file_category:               { type: 'string', constraint: 'letter | photo | receipt | spreadsheet' },
  file_creator:                { type: 'string', constraint: '6-digit number' },
  file_created_at:             { type: 'timestamptz', constraint: 'ISO 8601 Zulu' },
  disposal_time:               { type: 'string', constraint: '6 months | 2 years | 7 years | 45 years' },
  direction:                   { type: 'string', constraint: 'inbound | outbound' },
  file_received_at:            { type: 'timestamptz', constraint: 'file_created_at + 5min to 3 months' },
  first_analysis_complete_at:  { type: 'timestamptz', constraint: 'file_received_at + 0.5s to 5s' },
  second_analysis_complete_at: { type: 'timestamptz', constraint: 'file_received_at + 15s to 3min' },
  first_analysis_result:       { type: 'boolean',     constraint: 'PASSED (95%) | FAILED (5%)' },
}

const MAIN_ARCH = [
  {
    id: 'browser',
    label: 'Browser',
    sublabel: 'User interface',
    color: '#56607a',
    border: '#252a38',
    items: [],
  },
  {
    id: 'frontend',
    label: 'React Frontend',
    sublabel: 'localhost:3010',
    color: '#4f8ef5',
    border: '#4f8ef544',
    items: [
      { name: 'React',         version: '18.3' },
      { name: 'Vite',          version: '5.4' },
      { name: 'Recharts',      version: '2.13' },
      { name: 'Apollo Client', version: '3.11' },
    ],
  },
  {
    id: 'backend',
    label: 'Go Backend',
    sublabel: 'localhost:8080',
    color: '#3de89b',
    border: '#3de89b44',
    items: [
      { name: 'Go',           version: '1.21' },
      { name: 'graphql-go',   version: '0.8.1' },
      { name: 'lib/pq',       version: '1.10.9' },
    ],
  },
  {
    id: 'database',
    label: 'PostgreSQL',
    sublabel: 'localhost:5432',
    color: '#a78bfa',
    border: '#a78bfa44',
    items: [
      { name: 'PostgreSQL', version: '18' },
      { name: 'table',      version: 'file_metadata' },
    ],
  },
]

const CONNECTIONS = [
  { from: 'browser',  to: 'frontend', label: 'HTTP' },
  { from: 'frontend', to: 'backend',  label: 'GraphQL / HTTP' },
  { from: 'backend',  to: 'database', label: 'SQL / TCP' },
]

const BAU = {
  id: 'bau',
  label: 'BAU File Imitator',
  sublabel: '200 records / hour',
  color: '#f5c542',
  border: '#f5c54244',
  items: [
    { name: 'Go',        version: '1.21' },
    { name: 'lib/pq',    version: '1.10.9' },
    { name: 'rate',      version: '~1 per 18s' },
    { name: 'file_received_at', version: 'always NOW' },
  ],
}

export default function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Architecture */}
      <div className="chart-card">
        <h2><span className="dot" style={{ background: 'var(--teal)' }} />Project Architecture</h2>
        {/* Main flow row */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, justifyContent: 'center', flexWrap: 'wrap' }}>
          {MAIN_ARCH.map((node, i) => (
            <React.Fragment key={node.id}>
              <div style={{ border: `1px solid ${node.border}`, borderRadius: 10, padding: '18px 24px', minWidth: 180, background: '#12151e', flex: '1 1 160px', maxWidth: 220 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: node.color, marginBottom: 4 }}>{node.label}</div>
                <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: node.items.length ? 14 : 0, letterSpacing: '0.05em' }}>{node.sublabel}</div>
                {node.items.map(item => (
                  <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'DM Mono, monospace', marginBottom: 4, gap: 12 }}>
                    <span style={{ color: '#56607a' }}>{item.name}</span>
                    <span style={{ color: node.color }}>{item.version}</span>
                  </div>
                ))}
              </div>
              {i < MAIN_ARCH.length - 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 8px', gap: 4, minWidth: 90 }}>
                  <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#56607a', whiteSpace: 'nowrap' }}>{CONNECTIONS[i].label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <div style={{ flex: 1, height: 1, background: '#252a38' }} />
                    <div style={{ color: '#252a38', fontSize: 16, lineHeight: 1 }}>▶</div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* BAU imitator row — connects directly to PostgreSQL */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, paddingRight: 0, justifyContent: 'flex-end', gap: 0 }}>
          <div style={{ border: `1px solid ${BAU.border}`, borderRadius: 10, padding: '18px 24px', background: '#12151e', width: 220 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BAU.color, marginBottom: 4 }}>{BAU.label}</div>
            <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 14, letterSpacing: '0.05em' }}>{BAU.sublabel}</div>
            {BAU.items.map(item => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'DM Mono, monospace', marginBottom: 4, gap: 12 }}>
                <span style={{ color: '#56607a' }}>{item.name}</span>
                <span style={{ color: BAU.color }}>{item.version}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px', gap: 4, minWidth: 90 }}>
            <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#56607a', whiteSpace: 'nowrap' }}>SQL / TCP</div>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <div style={{ flex: 1, height: 1, background: `${BAU.color}66` }} />
              <div style={{ color: `${BAU.color}99`, fontSize: 16, lineHeight: 1 }}>▶</div>
            </div>
          </div>
          <div style={{ width: 220, fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#a78bfa', textAlign: 'center', padding: '8px 0' }}>
            PostgreSQL<br />
            <span style={{ color: '#56607a', fontSize: 10 }}>inserts direct to file_metadata</span>
          </div>
        </div>

        {/* Data file note */}
        <div style={{
          marginTop: 20,
          padding: '10px 16px',
          background: '#12151e',
          border: '1px solid #252a38',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: 'DM Mono, monospace',
          color: '#56607a',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ color: '#f5c542' }}>seed</span>
          <span>file_metadata_1000.json → Go backend seeds PostgreSQL on first run if table is empty</span>
        </div>
      </div>

      {/* Data Model */}
      <div className="chart-card">
        <h2><span className="dot" style={{ background: 'var(--accent)' }} />Data Model — file_metadata</h2>
        <div style={{
          background: '#0b0d12',
          border: '1px solid #252a38',
          borderRadius: 8,
          padding: '20px 24px',
          fontFamily: 'DM Mono, monospace',
          fontSize: 12,
          lineHeight: 1.8,
          overflowX: 'auto',
        }}>
          <div style={{ color: '#56607a', marginBottom: 8 }}>{'{'}</div>
          {Object.entries(DATA_MODEL).map(([field, meta]) => (
            <div key={field} style={{ display: 'flex', gap: 8, paddingLeft: 24, flexWrap: 'wrap' }}>
              <span style={{ color: '#4f8ef5' }}>"{field}"</span>
              <span style={{ color: '#56607a' }}>:</span>
              <span style={{ color: '#56607a' }}>{'{'}</span>
              <span style={{ color: '#56607a' }}>type:</span>
              <span style={{ color: '#3de89b' }}>"{meta.type}"</span>
              <span style={{ color: '#56607a' }}>,</span>
              <span style={{ color: '#56607a' }}>constraint:</span>
              <span style={{ color: '#f5c542' }}>"{meta.constraint}"</span>
              <span style={{ color: '#56607a' }}>{'},'}</span>
            </div>
          ))}
          <div style={{ color: '#56607a', marginTop: 8 }}>{'}'}</div>
        </div>
      </div>

    </div>
  )
}
