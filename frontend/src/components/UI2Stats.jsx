import React from 'react'
import { useQuery, gql } from '@apollo/client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const Q = gql`
  query GetUI2Stats {
    ui2Stats {
      totalThisHour
      totalAllTime
      byEngine  { engine  count }
      byOutcome { outcome count }
      riskScore { floor average ceiling }
    }
  }
`

const ENGINE_COLORS  = ['#3de89b', '#4f8ef5', '#a78bfa']
const OUTCOME_COLORS = ['#3de89b', '#f04f5a', '#f5c542']
const RISK_COLOR     = '#fb923c'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#181c27', border: '1px solid #252a38', borderRadius: 8, padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
      <div style={{ color: payload[0].payload.fill, fontWeight: 600, marginBottom: 2 }}>{payload[0].name}</div>
      <div style={{ color: '#e4e7f0' }}>{payload[0].value} lodgements</div>
    </div>
  )
}

const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function UI2Content({ stats }) {
  const { totalThisHour, totalAllTime, byEngine, byOutcome, riskScore } = stats
  const engineData  = byEngine.map((d, i)  => ({ ...d, name: d.engine,  fill: ENGINE_COLORS[i  % ENGINE_COLORS.length] }))
  const outcomeData = byOutcome.map((d, i) => ({ ...d, name: d.outcome, fill: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }))

  return (
    <>
      <div className="kpis">
        <div className="kpi-card">
          <div className="kpi-label">This Hour (UI-2)</div>
          <div className="kpi-value" style={{ color: 'var(--orange)' }}>{totalThisHour.toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">All Time (UI-2)</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>{totalAllTime.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <div className="chart-card">
          <h2><span className="dot" style={{ background: '#3de89b' }} />Engine Distribution (UI-2)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={engineData} dataKey="count" nameKey="name" cx="50%" cy="50%"
                outerRadius={85} labelLine={false} label={renderLabel}>
                {engineData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#56607a', fontSize: 12, fontFamily: 'DM Mono, monospace' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h2><span className="dot" style={{ background: '#f04f5a' }} />Assessment Outcome (UI-2)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={outcomeData} dataKey="count" nameKey="name" cx="50%" cy="50%"
                outerRadius={85} labelLine={false} label={renderLabel}>
                {outcomeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#56607a', fontSize: 12, fontFamily: 'DM Mono, monospace' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h2><span className="dot" style={{ background: RISK_COLOR }} />Risk Score (UI-2)</h2>
          <div style={{
            background: '#12151e', border: `1px solid ${RISK_COLOR}44`,
            borderRadius: 10, padding: '20px 24px', marginTop: 10,
          }}>
            <div style={{
              fontSize: 10, fontFamily: 'DM Mono, monospace', color: RISK_COLOR,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20,
            }}>
              risk score range · 1–100
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>floor</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e7f0', fontFamily: 'DM Mono, monospace' }}>{riskScore.floor}</div>
              </div>
              <div style={{ color: '#252a38', fontSize: 20 }}>·</div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>average</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f5c542', fontFamily: 'DM Mono, monospace', letterSpacing: '-0.5px' }}>
                  {riskScore.average.toFixed(1)}
                </div>
              </div>
              <div style={{ color: '#252a38', fontSize: 20 }}>·</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#56607a', marginBottom: 4 }}>ceiling</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e7f0', fontFamily: 'DM Mono, monospace' }}>{riskScore.ceiling}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function UI2Stats() {
  const { data, loading, error } = useQuery(Q)

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0',
        fontFamily: 'DM Mono, monospace', fontSize: 11,
        color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        <div style={{ flex: 1, height: 1, background: '#fb923c33' }} />
        UI-2 Ingress — Focus View
        <div style={{ flex: 1, height: 1, background: '#fb923c33' }} />
      </div>

      {loading && <div className="loading">loading…</div>}
      {error   && <div className="error">error: {error.message}</div>}
      {data    && <UI2Content stats={data.ui2Stats} />}
    </>
  )
}
