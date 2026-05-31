import React from 'react'

const DATA_MODEL = {
  customer_number:             { type: 'string',      constraint: '9 digits' },
  customer_type:               { type: 'string',      constraint: 'type_1 | type_2 | type_3' },
  file_name:                   { type: 'string',      constraint: 'min 2 words · .pdf .jpeg .docx .xlsx' },
  file_category:               { type: 'string',      constraint: 'letter | photo | receipt | spreadsheet' },
  file_creator:                { type: 'string',      constraint: '6-digit number' },
  file_created_at:             { type: 'timestamptz', constraint: 'ISO 8601 Zulu' },
  disposal_time:               { type: 'string',      constraint: '6 months | 2 years | 7 years | 45 years' },
  direction:                   { type: 'string',      constraint: 'inbound | outbound' },
  file_received_at:            { type: 'timestamptz', constraint: 'file_created_at + 5min to 3 months' },
  first_analysis_complete_at:  { type: 'timestamptz', constraint: 'file_received_at + 0.5s to 5s' },
  second_analysis_complete_at: { type: 'timestamptz', constraint: 'file_received_at + 15s to 3min' },
  first_analysis_result:       { type: 'boolean',     constraint: 'PASSED (95%) | FAILED (5%)' },
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const mono = { fontFamily: 'DM Mono, monospace' }

function Arrow({ label, color = '#252a38', labelColor = '#56607a' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 8px', gap: 4, minWidth: 80 }}>
      <div style={{ ...mono, fontSize: 10, color: labelColor, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <div style={{ flex: 1, height: 1, background: color }} />
        <div style={{ color, fontSize: 16, lineHeight: 1 }}>▶</div>
      </div>
    </div>
  )
}

function Node({ label, sublabel, color, border, items = [], tag }) {
  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 10, padding: '16px 20px', background: '#12151e', flex: '1 1 160px', minWidth: 170, maxWidth: 230 }}>
      {tag && <div style={{ ...mono, fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, opacity: 0.7 }}>{tag}</div>}
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 2 }}>{label}</div>
      <div style={{ ...mono, fontSize: 10, color: '#56607a', marginBottom: items.length ? 12 : 0, letterSpacing: '0.04em' }}>{sublabel}</div>
      {items.map(item => (
        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 11, marginBottom: 3, gap: 10 }}>
          <span style={{ color: '#56607a' }}>{item.name}</span>
          <span style={{ color }}>{item.version}</span>
        </div>
      ))}
    </div>
  )
}

function SchemaTable({ title, color, columns, retention }) {
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${color}44`, flex: '1 1 300px' }}>
      <div style={{ background: `${color}18`, borderBottom: `1px solid ${color}33`, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ ...mono, fontSize: 12, fontWeight: 700, color, letterSpacing: '0.05em' }}>{title}</span>
        {retention && (
          <span style={{ ...mono, fontSize: 10, color: '#f04f5a', marginLeft: 'auto', background: '#f04f5a18', padding: '2px 8px', borderRadius: 4, border: '1px solid #f04f5a33' }}>
            retention: {retention}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 110px 1fr', background: '#0b0d12', borderBottom: '1px solid #252a38', padding: '5px 12px', gap: 6 }}>
        {['', 'column', 'type', 'constraint'].map(h => (
          <span key={h} style={{ ...mono, fontSize: 9, color: '#56607a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
        ))}
      </div>
      {columns.map((col, i) => (
        <div key={col.name} style={{
          display: 'grid', gridTemplateColumns: '22px 1fr 110px 1fr',
          padding: '6px 12px', gap: 6, alignItems: 'center',
          background: i % 2 === 0 ? '#181c27' : '#12151e',
          borderBottom: i < columns.length - 1 ? '1px solid #252a38' : 'none',
        }}>
          <span style={{ ...mono, fontSize: 9, color: col.pk ? '#f5c542' : '#252a38', fontWeight: 700 }}>{col.pk ? 'PK' : ''}</span>
          <span style={{ ...mono, fontSize: 11, color: col.pk ? '#f5c542' : '#e4e7f0' }}>{col.name}</span>
          <span style={{ ...mono, fontSize: 10, color: '#2dd4bf' }}>{col.type}</span>
          <span style={{ ...mono, fontSize: 10, color: '#56607a' }}>{col.constraint}</span>
        </div>
      ))}
    </div>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────────

const FILE_METADATA_COLS = [
  { name: 'id',                          type: 'SERIAL',       constraint: 'PRIMARY KEY',                   pk: true },
  { name: 'customer_number',             type: 'VARCHAR(9)',   constraint: '9 digits' },
  { name: 'customer_type',               type: 'VARCHAR(10)',  constraint: 'type_1 | type_2 | type_3' },
  { name: 'file_name',                   type: 'VARCHAR(255)', constraint: 'min 2 words' },
  { name: 'file_category',               type: 'VARCHAR(20)',  constraint: 'letter | photo | receipt | spreadsheet' },
  { name: 'file_creator',                type: 'VARCHAR(6)',   constraint: '6-digit number' },
  { name: 'file_created_at',             type: 'TIMESTAMPTZ', constraint: 'ISO 8601 Zulu' },
  { name: 'disposal_time',               type: 'VARCHAR(20)',  constraint: '6m | 2y | 7y | 45y' },
  { name: 'direction',                   type: 'VARCHAR(10)',  constraint: 'inbound | outbound' },
  { name: 'file_received_at',            type: 'TIMESTAMPTZ', constraint: 'created_at + 5min→3mo' },
  { name: 'first_analysis_complete_at',  type: 'TIMESTAMPTZ', constraint: 'received_at + 0.5s→5s' },
  { name: 'second_analysis_complete_at', type: 'TIMESTAMPTZ', constraint: 'received_at + 15s→3min' },
  { name: 'first_analysis_result',       type: 'BOOLEAN',     constraint: 'PASSED 95% | FAILED 5%' },
]

const STATS_TABLES = [
  {
    title: 'stats_totals',
    color: '#3de89b',
    columns: [
      { name: 'id',          type: 'INT',        constraint: 'PRIMARY KEY (always 1)', pk: true },
      { name: 'total_files', type: 'BIGINT',     constraint: 'running count of all files ever' },
      { name: 'last_id',     type: 'BIGINT',     constraint: 'last file_metadata.id processed' },
      { name: 'updated_at',  type: 'TIMESTAMPTZ', constraint: 'last aggregation run' },
    ],
  },
  {
    title: 'stats_by_category',
    color: '#4f8ef5',
    columns: [
      { name: 'file_category', type: 'VARCHAR(20)', constraint: 'PRIMARY KEY', pk: true },
      { name: 'count',         type: 'BIGINT',      constraint: 'cumulative total' },
      { name: 'updated_at',    type: 'TIMESTAMPTZ', constraint: '' },
    ],
  },
  {
    title: 'stats_by_direction',
    color: '#2dd4bf',
    columns: [
      { name: 'direction',  type: 'VARCHAR(10)', constraint: 'PRIMARY KEY', pk: true },
      { name: 'count',      type: 'BIGINT',      constraint: 'cumulative total' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', constraint: '' },
    ],
  },
  {
    title: 'stats_by_customer_type',
    color: '#a78bfa',
    columns: [
      { name: 'customer_type', type: 'VARCHAR(10)', constraint: 'PRIMARY KEY', pk: true },
      { name: 'count',         type: 'BIGINT',      constraint: 'cumulative total' },
      { name: 'updated_at',    type: 'TIMESTAMPTZ', constraint: '' },
    ],
  },
  {
    title: 'stats_received_by_hour',
    color: '#f5c542',
    columns: [
      { name: 'hour_bucket', type: 'TIMESTAMPTZ', constraint: 'PRIMARY KEY — truncated to hour', pk: true },
      { name: 'count',       type: 'BIGINT',      constraint: 'files received in that hour' },
    ],
  },
  {
    title: 'stats_analysis_by_hour',
    color: '#fb923c',
    columns: [
      { name: 'hour_bucket', type: 'TIMESTAMPTZ', constraint: 'PK (composite)', pk: true },
      { name: 'result',      type: 'BOOLEAN',     constraint: 'PK (composite) — true=PASSED', pk: true },
      { name: 'count',       type: 'BIGINT',      constraint: 'analysis results in that hour' },
    ],
  },
  {
    title: 'stats_lag',
    color: '#2dd4bf',
    columns: [
      { name: 'lag_type',    type: 'VARCHAR(50)', constraint: 'PRIMARY KEY', pk: true },
      { name: 'avg_seconds', type: 'FLOAT',       constraint: 'recomputed from 2-day window' },
      { name: 'min_seconds', type: 'FLOAT',       constraint: '' },
      { name: 'max_seconds', type: 'FLOAT',       constraint: '' },
      { name: 'p95_seconds', type: 'FLOAT',       constraint: 'PERCENTILE_CONT(0.95)' },
      { name: 'updated_at',  type: 'TIMESTAMPTZ', constraint: '' },
    ],
  },
  {
    title: 'stats_disposal_tracking',
    color: '#f04f5a',
    columns: [
      { name: 'file_id',         type: 'BIGINT',      constraint: 'PRIMARY KEY (file_metadata.id)', pk: true },
      { name: 'file_name',       type: 'VARCHAR(255)', constraint: '' },
      { name: 'customer_number', type: 'VARCHAR(9)',   constraint: '' },
      { name: 'file_creator',    type: 'VARCHAR(6)',   constraint: '' },
      { name: 'file_created_at', type: 'TIMESTAMPTZ', constraint: '' },
      { name: 'disposal_time',   type: 'VARCHAR(20)',  constraint: '6m | 2y | 7y | 45y' },
      { name: 'disposal_date',   type: 'TIMESTAMPTZ', constraint: 'computed at ingest — never deleted' },
    ],
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Architecture ── */}
      <div className="chart-card">
        <h2><span className="dot" style={{ background: 'var(--teal)' }} />Project Architecture</h2>

        {/* Row 1: Browser → React → GraphQL API → Stats DB */}
        <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', flexWrap: 'wrap', gap: 0 }}>
          <Node label="Browser" sublabel="User interface" color="#56607a" border="#252a38" />
          <Arrow label="HTTP" />
          <Node label="React Frontend" sublabel="file-dashboard-lbro.vercel.app" color="#4f8ef5" border="#4f8ef544"
            items={[{ name: 'React', version: '18.3' }, { name: 'Vite', version: '5.4' }, { name: 'Recharts', version: '2.13' }, { name: 'Apollo Client', version: '3.11' }]} />
          <Arrow label="GraphQL / HTTP" />
          <Node tag="Go Backend — Function 2" label="GraphQL API" sublabel="prolific-nature-production-5839.up.railway.app" color="#3de89b" border="#3de89b44"
            items={[{ name: 'Go', version: '1.21' }, { name: 'graphql-go', version: '0.8.1' }, { name: 'lib/pq', version: '1.10.9' }]} />
          <Arrow label="SQL / TCP" />
          <Node label="Stats Tables" sublabel="Railway managed PostgreSQL" color="#a78bfa" border="#a78bfa44"
            items={[{ name: 'PostgreSQL', version: '18' }, { name: 'tables', version: '8 stats tables' }]} />
        </div>

        {/* Row 2: BAU → file_metadata → Aggregator → Stats DB */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 0 }}>
          <Node label="BAU File Imitator" sublabel="200 records / hour" color="#f5c542" border="#f5c54244"
            items={[{ name: 'Go', version: '1.21' }, { name: 'rate', version: '~1 per 18s' }, { name: 'file_received_at', version: 'always NOW' }]} />
          <Arrow label="SQL / TCP" color="#f5c54266" labelColor="#f5c54299" />
          <Node label="file_metadata" sublabel="source table — 2-day retention" color="#f04f5a" border="#f04f5a44"
            items={[{ name: 'retention', version: '2 days' }, { name: 'reason', version: 'privacy policy' }, { name: 'records', version: 'auto-pruned' }]} />
          <Arrow label="reads new rows" color="#3de89b66" labelColor="#3de89b99" />
          <Node tag="Go Backend — Function 1" label="Aggregator" sublabel="runs every 30 seconds" color="#3de89b" border="#3de89b44"
            items={[{ name: 'processNewFiles', version: 'increments stats' }, { name: 'recomputeLag', version: 'P95 from 2-day window' }, { name: 'pruneRetention', version: 'deletes >2 days' }]} />
          <Arrow label="SQL / TCP" color="#a78bfa66" labelColor="#a78bfa99" />
          <Node label="Stats Tables" sublabel="persists beyond retention" color="#a78bfa" border="#a78bfa44"
            items={[{ name: 'survive', version: 'retention window' }, { name: 'serve', version: 'all dashboard queries' }]} />
        </div>

        {/* Notes */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ ...mono, fontSize: 11, color: '#56607a', background: '#12151e', border: '1px solid #252a38', borderRadius: 8, padding: '10px 14px', flex: 1 }}>
            <span style={{ color: '#f5c542' }}>seed</span>{'  '}file_metadata_1000.json → seeded on first run if table is empty, then processed by aggregator
          </div>
          <div style={{ ...mono, fontSize: 11, color: '#56607a', background: '#12151e', border: '1px solid #f04f5a33', borderRadius: 8, padding: '10px 14px', flex: 1 }}>
            <span style={{ color: '#f04f5a' }}>privacy</span>{'  '}raw file records deleted after 2 days — all statistics persist indefinitely in stats tables
          </div>
        </div>
      </div>

      {/* ── DB Schema: file_metadata ── */}
      <div className="chart-card">
        <h2><span className="dot" style={{ background: 'var(--purple)' }} />Database Schema — Source Table</h2>
        <SchemaTable title="file_metadata" color="#a78bfa" retention="2 days (privacy)" columns={FILE_METADATA_COLS} />
      </div>

      {/* ── DB Schema: stats tables ── */}
      <div className="chart-card">
        <h2><span className="dot" style={{ background: 'var(--green)' }} />Database Schema — Stats Tables</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...mono, fontSize: 11, color: '#56607a', background: '#12151e', border: '1px solid #3de89b22', borderRadius: 8, padding: '10px 14px' }}>
            <span style={{ color: '#3de89b' }}>written by</span>{'  '}Aggregator (Function 1) every 30s — <span style={{ color: '#3de89b' }}>read by</span>{'  '}GraphQL API (Function 2) on every dashboard query — records never deleted
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {STATS_TABLES.map(t => <SchemaTable key={t.title} {...t} />)}
          </div>
        </div>
      </div>

      {/* ── Data Model ── */}
      <div className="chart-card">
        <h2><span className="dot" style={{ background: 'var(--accent)' }} />Data Model — file_metadata</h2>
        <div style={{
          background: '#0b0d12', border: '1px solid #252a38', borderRadius: 8,
          padding: '20px 24px', ...mono, fontSize: 12, lineHeight: 1.8, overflowX: 'auto',
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
