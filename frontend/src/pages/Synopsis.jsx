import React from 'react'

const mono = { fontFamily: 'DM Mono, monospace' }

// Colour palette mirrors the dashboard theme variables.
const k = '#4f8ef5'   // keyword / type
const s = '#3de89b'   // string / good value
const c = '#56607a'   // comment / muted
const n = '#f5c542'   // number / highlight
const t = '#a78bfa'   // secondary type
const q = '#fb923c'   // SQL keyword
const r = '#f04f5a'   // warning / red

function Section({ title, dot = '#f5c542', children }) {
  return (
    <div className="chart-card">
      <h2><span className="dot" style={{ background: dot }} />{title}</h2>
      {children}
    </div>
  )
}

function Note({ color = n, children }) {
  return (
    <div style={{
      ...mono, fontSize: 11, color,
      background: `${color}10`, border: `1px solid ${color}30`,
      borderRadius: 7, padding: '9px 13px', marginTop: 10, lineHeight: 1.7,
    }}>
      {children}
    </div>
  )
}

// Renders a labelled code block. `lines` is an array of JSX elements (one per line).
function Block({ label, color = s, lines }) {
  return (
    <div style={{ marginTop: 10 }}>
      {label && (
        <div style={{ ...mono, fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
          {label}
        </div>
      )}
      <pre style={{
        ...mono, fontSize: 11, lineHeight: 1.75,
        background: '#0b0d12', border: '1px solid #252a38',
        borderRadius: 8, padding: '12px 16px', overflowX: 'auto',
        margin: 0,
      }}>
        {lines.map((line, i) => <div key={i}>{line}</div>)}
      </pre>
    </div>
  )
}

const kw  = (v) => <span style={{ color: k }}>{v}</span>
const str = (v) => <span style={{ color: s }}>{v}</span>
const cmt = (v) => <span style={{ color: c }}>{v}</span>
const num = (v) => <span style={{ color: n }}>{v}</span>
const typ = (v) => <span style={{ color: t }}>{v}</span>
const sql = (v) => <span style={{ color: q }}>{v}</span>
const red = (v) => <span style={{ color: r }}>{v}</span>
const dim = (v) => <span style={{ color: '#e4e7f0' }}>{v}</span>

// ── Pipeline diagram ──────────────────────────────────────────────────────────

function PipelineRow({ nodes }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0, marginBottom: 6 }}>
      {nodes.map((node, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <div style={{ ...mono, fontSize: 11, color: '#252a38', padding: '0 6px' }}>→</div>
          )}
          <div style={{
            ...mono, fontSize: 11,
            background: `${node.color}14`, border: `1px solid ${node.color}44`,
            borderRadius: 7, padding: '5px 12px', color: node.color, whiteSpace: 'nowrap',
          }}>
            {node.label}
            {node.sub && <span style={{ color: c, marginLeft: 6 }}>{node.sub}</span>}
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Two-column key/value table ────────────────────────────────────────────────

function KVTable({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '2px 0', marginTop: 10 }}>
      {rows.map(([key, val], i) => (
        <React.Fragment key={i}>
          <div style={{ ...mono, fontSize: 11, color: c, paddingRight: 16, paddingTop: 4 }}>{key}</div>
          <div style={{ ...mono, fontSize: 11, color: '#e4e7f0', paddingTop: 4, lineHeight: 1.6 }}>{val}</div>
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Synopsis() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Data pipeline ── */}
      <Section title="Data Pipeline" dot={s}>
        <PipelineRow nodes={[
          { label: 'BAU Imitator', color: n, sub: '~200 inserts/hr' },
          { label: 'file_metadata', color: r, sub: '2-day retention' },
          { label: 'Aggregator goroutine', color: s, sub: 'every 30 s' },
          { label: '8 stats tables', color: t, sub: 'persist forever' },
          { label: 'GraphQL API', color: k, sub: 'read-only' },
          { label: 'Apollo / React', color: '#2dd4bf', sub: '20 s refetch' },
        ]} />
        <Note color={c}>
          file_metadata is a staging table — pruned after 2 days for privacy. All dashboard queries
          read from stats tables that accumulate counts beyond the retention window.
          The aggregator is the only writer to stats tables; GraphQL resolvers are read-only.
        </Note>
      </Section>

      {/* ── Go backend ── */}
      <Section title="Go Backend — Single Binary, Two Roles" dot={s}>

        <Block label="startup sequence (main.go)" lines={[
          <>{kw('db.Ping')}{'  '}{cmt('// retried 15 × 2 s — Railway postgres may be slow to accept connections on cold deploy')}</>,
          <>{kw('setupDB()')}{'  '}{cmt('// idempotent: CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS')}</>,
          <>{kw('go')} {kw('func')}{'() { runAggregation(); ticker... }()  '}{cmt('// aggregator in background — HTTP server does not wait for catch-up')}</>,
          <>{kw('http.ListenAndServe')}({str('":8080"')}, mux){'  '}{cmt('// starts immediately regardless of aggregator state')}</>,
        ]} />

        <Note color={s}>
          The aggregator and HTTP server run concurrently from the same binary. Keeping them
          together avoids distributed coordination while still decoupling write and read paths.
        </Note>

        <div style={{ ...mono, fontSize: 10, color: n, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 20, marginBottom: 6 }}>
          Function 1 — Aggregator
        </div>

        <Block label="processNewFiles — key pattern" lines={[
          <>{kw('for')} {'{'}</>,
          <>{dim('  ')}lastID = {sql('SELECT')} last_id {sql('FROM')} stats_totals</>,
          <></>,
          <>{dim('  ')}{cmt('// Read all rows into memory before opening the transaction.')}</>,
          <>{dim('  ')}{cmt('// database/sql pool can assign different connections to *sql.Rows and *sql.Tx.')}</>,
          <>{dim('  ')}{cmt('// Mixing them causes a deadlock when the pool is exhausted.')}</>,
          <>{dim('  ')}batch = {sql('SELECT')} ... {sql('WHERE')} id {'>'} lastID {sql('LIMIT')} {num('500')}</>,
          <>{dim('  ')}rows.Close()</>,
          <></>,
          <>{dim('  ')}{kw('if')} len(batch) == {num('0')} {'{'} {kw('return')} {'}'}</>,
          <></>,
          <>{dim('  ')}{cmt('// One transaction per batch. If the process crashes before COMMIT,')}</>,
          <>{dim('  ')}{cmt('// last_id is unchanged → entire batch replayed on next startup.')}</>,
          <>{dim('  ')}{cmt('// ON CONFLICT DO UPDATE makes all upserts idempotent, so replay is safe.')}</>,
          <>{dim('  ')}tx = db.Begin()</>,
          <>{dim('  ')}{kw('for')} _, r := {kw('range')} batch {'{'}</>,
          <>{dim('    ')}{sql('INSERT INTO')} stats_by_category ... {sql('ON CONFLICT DO UPDATE SET')} count = count + {num('1')}</>,
          <>{dim('    ')}{cmt('// ... same for stats_by_direction, stats_by_customer_type,')}</>,
          <>{dim('    ')}{cmt('//     stats_received_by_hour, stats_analysis_by_hour, stats_disposal_tracking')}</>,
          <>{dim('  ')}{'}'}</>,
          <>{dim('  ')}{sql('UPDATE')} stats_totals {sql('SET')} total_files += len(batch), last_id = newLastID</>,
          <>{dim('  ')}tx.Commit()</>,
          <></>,
          <>{dim('  ')}{kw('if')} len(batch) {'<'} {num('500')} {'{'} {kw('return')} {'}'}{cmt('  // no more rows')}</>,
          <>{'}'}</>,
        ]} />

        <Block label="recomputeLag" lines={[
          <>{cmt('// Queries file_metadata directly — uses PERCENTILE_CONT(0.95) over the live 2-day window.')}</>,
          <>{cmt('// Runs outside the batch transaction; result replaces the previous row (ON CONFLICT DO UPDATE).')}</>,
          <>{cmt('// Column names injected via fmt.Sprintf from a hardcoded slice — not user input, safe.')}</>,
          <>{sql('INSERT INTO')} stats_lag ... {sql('SELECT')} {typ('PERCENTILE_CONT')}({num('0.95')}) {sql('WITHIN GROUP')} ({sql('ORDER BY')} {typ('EXTRACT')}({sql('EPOCH FROM')} (col_a - col_b)))</>,
          <>{sql('ON CONFLICT')} (lag_type) {sql('DO UPDATE SET')} avg_seconds=EXCLUDED.avg_seconds, ...</>,
        ]} />

        <Block label="pruneRetention" lines={[
          <>{cmt('// Runs after processNewFiles so no row is pruned before it has been counted.')}</>,
          <>{sql('DELETE FROM')} file_metadata {sql('WHERE')} file_received_at {'<'} {typ('NOW')}() - {typ('INTERVAL')} {str("'2 days'")}</>,
        ]} />

        <div style={{ ...mono, fontSize: 10, color: k, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 20, marginBottom: 6 }}>
          Function 2 — GraphQL API
        </div>

        <KVTable rows={[
          ['schema',          '7 query fields, no mutations. Built once at startup via graphql-go.'],
          ['resolvers',       'All query stats tables only. O(1) or O(small set) — no file_metadata scans.'],
          ['nullable columns','sql.NullBool / sql.NullTime guard against NULL scan panics. Seed records lack analysis timestamps; aggregator skips analysis stats for those rows.'],
          ['CORS',            'Wildcard origin — frontend on Vercel, backend on Railway, different domains.'],
          ['transport',       'Handles POST (JSON body) and GET (?query=...) for GraphQL.'],
          ['RESET_STATS',     'Env var: truncates all stats tables and resets last_id=0 at startup. Set once to recover from double-counting, then remove.'],
        ]} />
      </Section>

      {/* ── PostgreSQL schema ── */}
      <Section title="PostgreSQL — Schema Design" dot={t}>
        <KVTable rows={[
          [str('file_metadata'), 'Source table, SERIAL PK. Pruned after 2 days on file_received_at (always set; file_created_at may be historical).'],
          [str('stats_totals'), <>{dim('Singleton (id always 1). ')}{num('last_id')}{dim(' is the aggregation watermark — used by processNewFiles as a cursor. ')}{num('total_files')}{dim(' is cumulative.')}</>],
          [str('stats_by_{category|direction|customer_type}'), 'Cumulative BIGINT counts keyed by enum value. Upserted per record; never reset except via RESET_STATS.'],
          [str('stats_received_by_hour'), <>TIMESTAMPTZ PK truncated to the hour. Queried with {sql('FILTER WHERE')} hour_bucket {'>='} {typ('DATE_TRUNC')}({str("'week'")}...) for thisHour/Week/Year.</>],
          [str('stats_analysis_by_hour'), <>Composite PK (hour_bucket, result). Same hour-bucket pattern for pass/fail counts.</>],
          [str('stats_lag'), 'One row per lag_type. Replaced entirely on each recomputeLag run using ON CONFLICT DO UPDATE. P95 computed by PostgreSQL ordered-set aggregate, not approximated in application code.'],
          [str('stats_disposal_tracking'), <>One row per file_id (PK). {num('disposal_date')} computed at ingest time from file_created_at + disposal_time. Rows are never deleted — overdue queries still work after file_metadata is pruned.</>],
        ]} />

        <Note color={t}>
          Hour-bucket timeseries tables grow indefinitely. For a production deployment, add a
          pg_cron job or a separate pruning pass to drop buckets older than the reporting horizon.
        </Note>
      </Section>

      {/* ── React frontend ── */}
      <Section title="React Frontend" dot={k}>

        <Block label="apolloClient.js" lines={[
          <>{kw('new')} {typ('ApolloClient')}({'{'}</>,
          <>{dim('  ')}uri: {typ('import.meta.env')}.VITE_API_URL ?? {str('"http://localhost:8080/graphql"')},{cmt('  // env var baked at Vite build time')}</>,
          <>{dim('  ')}cache: {kw('new')} {typ('InMemoryCache')}(),</>,
          <>{'}'}</>,
        ]} />

        <Block label="AutoRefresh (App.jsx)" lines={[
          <>{cmt('// Refetches every active query every 20 s to pick up BAU inserts.')}</>,
          <>{cmt('// include: "active" limits refetch to queries mounted in the current page —')}</>,
          <>{cmt('// switching to the About/Synopsis page stops unnecessary network calls.')}</>,
          <>{typ('useEffect')}(() {'=>'} {'{'}</>,
          <>{dim('  ')}{kw('const')} id = {typ('setInterval')}(() {'=>'} apollo.{kw('refetchQueries')}({'{'} include: {str('"active"')} {'}'}), {num('20000')})</>,
          <>{dim('  ')}{kw('return')} () {'=>'} {typ('clearInterval')}(id)</>,
          <>{'}'}, [apollo])</>,
        ]} />

        <Block label="component pattern (every chart component)" lines={[
          <>{kw('const')} Q = {kw('gql')}{str('`query { ... }`')}</>,
          <></>,
          <>{kw('export default function')} {typ('Foo')}() {'{'}</>,
          <>{dim('  ')}{kw('const')} {'{'} data, loading, error {'}'} = {kw('useQuery')}(Q)</>,
          <>{dim('  ')}{kw('if')} (loading) {kw('return')} {'<'}{typ('div')} className={str('"loading"')}{'>'}loading…{'</'}{typ('div')}{'>'}</>,
          <>{dim('  ')}{kw('if')} (error)   {kw('return')} {'<'}{typ('div')} className={str('"error"')}{'>'}{'{'}error.message{'}'}{'</'}{typ('div')}{'>'}</>,
          <>{dim('  ')}{cmt('// render from data')}</>,
          <>{'}'}</>,
        ]} />

        <KVTable rows={[
          ['routing',       'useState (no router). Page switch unmounts components; their queries become inactive and are excluded from AutoRefresh.'],
          ['pie charts',    'Recharts PieChart. Label renderer suppressed at < 5% to prevent overlap on small slices. Custom tooltip reads payload[0].payload.fill for slice-matched colour.'],
          ['LagStats',      'Formats seconds: ≥ 60 s → "mm.mm m", else "ss.ss s". Reads stats_lag via lagStats resolver.'],
          ['OverdueFilesTable', 'Client-side pagination (PAGE_SIZE = 20). Data comes from stats_disposal_tracking via overdueFiles resolver; sorted by disposal_date ASC (most overdue first).'],
          ['KPIBar',        'Derives "Total Files" by summing counts from filesByCategory — stats_totals.total_files is not exposed as a GraphQL field.'],
        ]} />
      </Section>

      {/* ── BAU imitator ── */}
      <Section title="BAU Imitator — bau/main.go (Separate Binary)" dot={n}>

        <Block label="weighted random selection" lines={[
          <>{cmt('// Avoids uniform distribution: customer_type (55/30/15%), file_category (42/28/18/12%).')}</>,
          <>{kw('func')} {typ('pickWeighted')}(options []struct{'{'} val {kw('string')}; w {kw('int')} {'}'}) {kw('string')} {'{'}</>,
          <>{dim('  ')}total := {num('0')}; {kw('for')} _, o := {kw('range')} options {'{'} total += o.w {'}'}</>,
          <>{dim('  ')}r := {typ('rand')}.{kw('Intn')}(total)</>,
          <>{dim('  ')}{kw('for')} _, o := {kw('range')} options {'{'} r -= o.w; {kw('if')} r {'<'} {num('0')} {'{'} {kw('return')} o.val {'}'} {'}'}</>,
          <>{dim('  ')}{kw('return')} options[len(options)-{num('1')}].val</>,
          <>{'}'}</>,
        ]} />

        <KVTable rows={[
          ['insert cadence',      '5–31 s uniform random → mean 18 s → ~200/hr.'],
          ['file_received_at',    'Always NOW(). file_created_at is NOW() minus a random 5 min – 3 month lag, simulating real-world creation-to-receipt delay without a queue.'],
          ['first_analysis_result', 'rand.Float64() < 0.95 — 95% PASSED, 5% FAILED, consistent with seed data constraint.'],
          ['PID file',            'Writes PID to bau.pid at startup; manage.ps1 reads it for taskkill on stop.'],
          ['DB connect',          'Same retry loop as backend: 15 × 2 s — Railway postgres may be slow on cold start.'],
        ]} />
      </Section>

    </div>
  )
}
