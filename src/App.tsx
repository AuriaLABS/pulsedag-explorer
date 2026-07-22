import { FormEvent, useEffect, useMemo, useState } from 'react'
import { DagGraph } from './components/DagGraph'
import { MetricCard } from './components/MetricCard'
import { explorerApi } from './lib/api'
import type { DagEvent, NetworkStats, NodeInfo, SearchResult } from './types'

const number = new Intl.NumberFormat('en-US')

function App() {
  const [stats, setStats] = useState<NetworkStats | null>(null)
  const [events, setEvents] = useState<DagEvent[]>([])
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [selectedEvent, setSelectedEvent] = useState<DagEvent | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [activeView, setActiveView] = useState<'overview' | 'events' | 'nodes'>('overview')

  useEffect(() => {
    Promise.all([
      explorerApi.getNetworkStats(),
      explorerApi.getRecentEvents(),
      explorerApi.getNodes(),
    ]).then(([networkStats, recentEvents, networkNodes]) => {
      setStats(networkStats)
      setEvents(recentEvents)
      setNodes(networkNodes)
    })
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const latestEvent = events[0]
  const onlineNodes = useMemo(() => nodes.filter((node) => node.status === 'online').length, [nodes])

  async function handleSearch(event: FormEvent) {
    event.preventDefault()
    const matches = await explorerApi.search(query)
    setResults(matches)
  }

  function openSearchResult(result: SearchResult) {
    const match = events.find((event) => event.id === result.id)
    if (match) setSelectedEvent(match)
    setResults([])
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveView('overview')} aria-label="PulseDAG home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>PulseDAG</strong><small>EXPLORER</small></span>
        </button>

        <nav aria-label="Explorer navigation">
          <button className={activeView === 'overview' ? 'active' : ''} onClick={() => setActiveView('overview')}><span>⌁</span>Overview</button>
          <button className={activeView === 'events' ? 'active' : ''} onClick={() => setActiveView('events')}><span>◇</span>DAG events</button>
          <button className={activeView === 'nodes' ? 'active' : ''} onClick={() => setActiveView('nodes')}><span>◉</span>Nodes</button>
        </nav>

        <div className="sidebar-footer">
          <div className="network-indicator"><i />Testnet live</div>
          <small>Mock data mode</small>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">Network intelligence</span>
            <h1>{activeView === 'overview' ? 'Overview' : activeView === 'events' ? 'DAG events' : 'Network nodes'}</h1>
          </div>
          <div className="topbar-actions">
            <span className="sync-pill"><i />Synced · {latestEvent?.age ?? '—'}</span>
            <button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
              {theme === 'dark' ? '☼' : '◐'}
            </button>
          </div>
        </header>

        <section className="search-panel">
          <div>
            <span className="eyebrow">Explore PulseDAG</span>
            <h2>Search the graph.</h2>
            <p>Inspect an event, transaction, address or node identifier.</p>
          </div>
          <form onSubmit={handleSearch}>
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Paste hash or node ID" aria-label="Search PulseDAG" />
            <button>Search</button>
            {results.length > 0 && (
              <div className="search-results">
                {results.map((result) => (
                  <button type="button" key={result.id} onClick={() => openSearchResult(result)}>
                    <strong>{result.title}</strong><small>{result.subtitle}</small>
                  </button>
                ))}
              </div>
            )}
          </form>
        </section>

        {activeView === 'overview' && (
          <>
            <section className="metrics-grid">
              <MetricCard label="DAG height" value={stats ? number.format(stats.dagHeight) : '—'} detail="Accepted event frontier" trend="+1,284" />
              <MetricCard label="Throughput" value={stats ? `${stats.eventsPerSecond.toFixed(1)} EPS` : '—'} detail="Rolling 60-second average" trend="+8.2%" />
              <MetricCard label="Active nodes" value={stats ? number.format(stats.activeNodes) : '—'} detail={`${onlineNodes}/${nodes.length} indexed nodes online`} />
              <MetricCard label="Median finality" value={stats ? `${stats.medianFinalityMs} ms` : '—'} detail="Observed confirmation time" trend="−12 ms" />
            </section>

            <section className="dashboard-grid">
              <article className="panel dag-panel">
                <div className="panel-header"><div><span className="eyebrow">Live topology</span><h3>Recent DAG activity</h3></div><span className="live-label"><i />Streaming</span></div>
                <DagGraph events={events} onSelect={setSelectedEvent} />
                <div className="dag-legend"><span><i className="accepted" />Accepted</span><span><i className="pending" />Pending</span><span>Click a vertex to inspect</span></div>
              </article>

              <article className="panel load-panel">
                <div className="panel-header"><div><span className="eyebrow">Capacity</span><h3>Network load</h3></div><strong>{stats?.networkLoad ?? 0}%</strong></div>
                <div className="load-ring" style={{ '--load': `${stats?.networkLoad ?? 0}%` } as React.CSSProperties}><span>{stats?.eventsPerSecond.toFixed(0) ?? 0}<small>EPS</small></span></div>
                <div className="load-details"><span><small>24h transactions</small><strong>{stats ? number.format(stats.transactions24h) : '—'}</strong></span><span><small>Headroom</small><strong>{stats ? 100 - stats.networkLoad : 0}%</strong></span></div>
              </article>
            </section>
          </>
        )}

        {(activeView === 'overview' || activeView === 'events') && (
          <section className="panel table-panel">
            <div className="panel-header"><div><span className="eyebrow">Ledger feed</span><h3>Latest events</h3></div><button className="text-button" onClick={() => setActiveView('events')}>View all →</button></div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Event</th><th>Age</th><th>Transactions</th><th>Size</th><th>Issuer</th><th>Status</th></tr></thead>
                <tbody>{events.map((event) => (
                  <tr key={event.id} onClick={() => setSelectedEvent(event)}>
                    <td><span className="hash">{event.shortId}</span></td><td>{event.age}</td><td>{event.transactions}</td><td>{(event.sizeBytes / 1024).toFixed(1)} KB</td><td>{event.issuer}</td><td><span className={`status status-${event.status}`}><i />{event.status}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}

        {activeView === 'nodes' && (
          <section className="nodes-grid">
            {nodes.map((node) => (
              <article className="panel node-card" key={node.id}>
                <div className="node-card-header"><span className={`node-orb ${node.status}`} /><span className={`status status-${node.status === 'online' ? 'accepted' : 'pending'}`}><i />{node.status}</span></div>
                <h3>{node.label}</h3><p>{node.region}</p>
                <dl><div><dt>Version</dt><dd>{node.version}</dd></div><div><dt>Latency</dt><dd>{node.latencyMs} ms</dd></div><div><dt>Node ID</dt><dd>{node.id}</dd></div></dl>
              </article>
            ))}
          </section>
        )}
      </main>

      {selectedEvent && (
        <div className="drawer-backdrop" onClick={() => setSelectedEvent(null)}>
          <aside className="detail-drawer" onClick={(event) => event.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelectedEvent(null)} aria-label="Close event details">×</button>
            <span className="eyebrow">DAG event</span><h2>{selectedEvent.shortId}</h2>
            <span className={`status status-${selectedEvent.status}`}><i />{selectedEvent.status}</span>
            <dl>
              <div><dt>Full hash</dt><dd className="wrap-hash">{selectedEvent.id}</dd></div>
              <div><dt>Timestamp</dt><dd>{new Date(selectedEvent.timestamp).toLocaleString()}</dd></div>
              <div><dt>Issuer</dt><dd>{selectedEvent.issuer}</dd></div>
              <div><dt>Transactions</dt><dd>{selectedEvent.transactions}</dd></div>
              <div><dt>Payload size</dt><dd>{number.format(selectedEvent.sizeBytes)} bytes</dd></div>
              <div><dt>Parents</dt><dd>{selectedEvent.parents.map((parent) => <span className="parent-hash" key={parent}>{parent}</span>)}</dd></div>
            </dl>
          </aside>
        </div>
      )}
    </div>
  )
}

export default App
