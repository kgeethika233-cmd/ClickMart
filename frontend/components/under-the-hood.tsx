'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, Clock, Database, RefreshCw, Search, Server, Zap } from 'lucide-react'
import { getUnderTheHood, type UnderTheHoodData } from '@/lib/under-the-hood'

export default function UnderTheHood() {
  const [data, setData] = useState<UnderTheHoodData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const fetchTelemetry = async () => {
      try {
        const result = await getUnderTheHood(controller.signal)
        if (active) {
          setData(result)
          setError(null)
          setLastRefreshed(new Date())
          setLoading(false)
        }
      } catch (err: any) {
        if (active && err.name !== 'AbortError') {
          setError(err.message || 'Telemetry unavailable')
          setLoading(false)
        }
      }
    }

    // Initial fetch
    void fetchTelemetry()

    // Poll every 2 seconds
    const interval = setInterval(() => {
      void fetchTelemetry()
    }, 2000)

    return () => {
      active = false
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  return (
    <main className="wrap commerce-page" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0284c7' }}>
            ARCHITECTURE &amp; CLOUD TELEMETRY
          </span>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0.25rem 0' }}>Under the Hood</h1>
          <p style={{ color: '#64748b', margin: 0 }}>
            Live distributed systems telemetry proving real work across Aiven PostgreSQL, Apache Kafka, and OpenSearch.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} style={{ color: '#0284c7' }} />
          <span>Polling live every 2s</span>
          {lastRefreshed && <span style={{ color: '#94a3b8' }}>· {lastRefreshed.toLocaleTimeString()}</span>}
        </div>
      </header>

      {/* Loading state */}
      {loading && !data && (
        <div role="status" style={{ padding: '4rem 2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <Activity size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: '#0284c7' }} />
          <p style={{ fontWeight: 500, color: '#334155' }}>Connecting to cloud services telemetry...</p>
        </div>
      )}

      {/* Error state */}
      {error && !data && (
        <div role="alert" style={{ padding: '2rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#991b1b', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <AlertCircle size={20} />
            <span>Could not connect to telemetry endpoint</span>
          </div>
          <p style={{ margin: '0.5rem 0 1rem' }}>{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* PANEL 1: Three Aiven Services Health */}
          <section aria-label="Service health" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={20} style={{ color: '#0284c7' }} /> 1. Aiven Cloud Services Health
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a' }}>PostgreSQL</strong>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>store-pg (Source of truth)</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, background: data.health.postgres === 'up' ? '#dcfce7' : '#fee2e2', color: data.health.postgres === 'up' ? '#15803d' : '#b91c1c' }}>
                  {data.health.postgres === 'up' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {data.health.postgres.toUpperCase()}
                </span>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a' }}>Apache Kafka</strong>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>store-kafka (Event backbone)</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, background: data.health.kafka === 'up' ? '#dcfce7' : '#fee2e2', color: data.health.kafka === 'up' ? '#15803d' : '#b91c1c' }}>
                  {data.health.kafka === 'up' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {data.health.kafka.toUpperCase()}
                </span>
              </div>

              <div style={{ padding: '1rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a' }}>OpenSearch</strong>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>store-search (Catalog &amp; typos)</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, background: data.health.opensearch === 'up' ? '#dcfce7' : '#fee2e2', color: data.health.opensearch === 'up' ? '#15803d' : '#b91c1c' }}>
                  {data.health.opensearch === 'up' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {data.health.opensearch.toUpperCase()}
                </span>
              </div>
            </div>
          </section>

          {/* PANEL 5: Latest Search OpenSearch Proof */}
          <section aria-label="OpenSearch search proof" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={20} style={{ color: '#0284c7' }} /> 2. Live OpenSearch Execution Proof
            </h2>
            {data.latestSearch ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#166534', fontWeight: 600 }}>Active Search Query</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: 700, color: '#14532d' }}>&ldquo;{data.latestSearch.query}&rdquo;</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#166534', fontWeight: 600 }}>Normalized / Synonym</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: 600, color: '#14532d' }}>{data.latestSearch.normalizedQuery}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#166534', fontWeight: 600 }}>Typo Correction</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', fontWeight: 600, color: data.latestSearch.isCorrected ? '#c2410c' : '#14532d' }}>
                    {data.latestSearch.isCorrected ? 'Yes (Fuzzy match applied)' : 'Direct match'}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#166534', fontWeight: 600 }}>OpenSearch Matches</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: 700, color: '#14532d' }}>{data.latestSearch.hitCount} hits</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#166534', fontWeight: 600 }}>OpenSearch Execution Time</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: 700, color: '#15803d' }}>{data.latestSearch.tookMs} ms</p>
                </div>
              </div>
            ) : (
              <p style={{ color: '#64748b' }}>No searches recorded yet. Search a term to view live OpenSearch execution metrics.</p>
            )}
          </section>

          {/* PANEL 2: Latest 10 Orders PLACED -> CONFIRMED */}
          <section aria-label="Latest orders" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} style={{ color: '#0284c7' }} /> 3. Latest 10 Orders in PostgreSQL
            </h2>
            {data.latestOrders.length === 0 ? (
              <p style={{ color: '#64748b' }}>No orders placed yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.5rem' }}>Order ID</th>
                      <th style={{ padding: '0.5rem' }}>Customer</th>
                      <th style={{ padding: '0.5rem' }}>Masked Email</th>
                      <th style={{ padding: '0.5rem' }}>Amount</th>
                      <th style={{ padding: '0.5rem' }}>Status</th>
                      <th style={{ padding: '0.5rem' }}>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestOrders.map((o) => (
                      <tr key={o.orderId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                          {o.orderId.slice(0, 13)}...
                        </td>
                        <td style={{ padding: '0.5rem' }}>{o.customerName}</td>
                        <td style={{ padding: '0.5rem', color: '#64748b' }}>{o.customerEmail}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 600 }}>₹{(o.totalCents / 100).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: o.status === 'CONFIRMED' ? '#dcfce7' : '#fef3c7', color: o.status === 'CONFIRMED' ? '#15803d' : '#b45309' }}>
                            {o.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem', color: '#64748b' }}>{new Date(o.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* PANEL 3: Latest 20 Kafka Events */}
          <section aria-label="Latest Kafka events" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={20} style={{ color: '#0284c7' }} /> 4. Latest 20 Events on Apache Kafka Backbone
            </h2>
            {data.latestEvents.length === 0 ? (
              <p style={{ color: '#64748b' }}>No events recorded yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.5rem' }}>Topic</th>
                      <th style={{ padding: '0.5rem' }}>Event Key</th>
                      <th style={{ padding: '0.5rem' }}>Partition</th>
                      <th style={{ padding: '0.5rem' }}>Offset</th>
                      <th style={{ padding: '0.5rem' }}>Published At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestEvents.map((ev) => (
                      <tr key={ev.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: ev.topic === 'order.placed' ? '#e0f2fe' : ev.topic === 'inventory.updated' ? '#f3e8ff' : '#fef3c7', color: ev.topic === 'order.placed' ? '#0369a1' : ev.topic === 'inventory.updated' ? '#7e22ce' : '#b45309' }}>
                            {ev.topic}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{ev.key.slice(0, 16)}...</td>
                        <td style={{ padding: '0.5rem' }}>{ev.partition}</td>
                        <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>#{ev.offset}</td>
                        <td style={{ padding: '0.5rem', color: '#64748b' }}>{new Date(ev.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* PANEL 4: Asynchronous Consumer Actions */}
          <section aria-label="Consumer actions" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} style={{ color: '#0284c7' }} /> 5. Consumer Actions (Inventory, Notifications, Index Sync)
            </h2>
            {data.consumerActions.length === 0 ? (
              <p style={{ color: '#64748b' }}>No consumer actions recorded yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                      <th style={{ padding: '0.5rem' }}>Consumer Worker</th>
                      <th style={{ padding: '0.5rem' }}>Action Executed</th>
                      <th style={{ padding: '0.5rem' }}>Associated Event ID</th>
                      <th style={{ padding: '0.5rem' }}>Processed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.consumerActions.map((act, index) => (
                      <tr key={`${act.eventId}-${act.consumer}-${index}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 600, color: '#0f172a' }}>{act.consumer}</td>
                        <td style={{ padding: '0.5rem', color: '#15803d' }}>{act.action}</td>
                        <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#64748b' }}>{act.eventId.slice(0, 16)}...</td>
                        <td style={{ padding: '0.5rem', color: '#64748b' }}>{new Date(act.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

