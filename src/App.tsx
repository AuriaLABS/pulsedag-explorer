import { type ChangeEvent, type CSSProperties, type FormEvent, type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { DagGraph } from './components/DagGraph'
import { AddressDetails, TransactionDetails } from './components/EntityDetails'
import { MetricCard } from './components/MetricCard'
import { explorerApi } from './lib/api'
import type { AddressDetail, DagEvent, ExplorerSnapshot, SearchResult, TransactionDetail } from './types'

const number = new Intl.NumberFormat('en-US')

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load PulseDAG data'
}

function App() {
  const [snapshot, setSnapshot] = useState<ExplorerSnapshot | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<DagEvent | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<AddressDetail | null>(null)
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchMessage, setSearchMessage] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [activeView, setActiveView] = useState<'overview' | 'blocks' | 'node'>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const loadSnapshot = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const nextSnapshot = await explorerApi.getSnapshot()
      setSnapshot(nextSnapshot)
      setError('')
    } catch (loadError) {
      setError(readableError(loadError))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadSnapshot()
    const intervalId = window.setInterval(() => void loadSnapshot(true), explorerApi.pollIntervalMs)
    return () => window.clearInterval(intervalId)
  }, [loadSnapshot])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const stats = snapshot?.stats
  const events = snapshot?.events ?? []
  const nodes = snapshot?.nodes ?? []
  const latestEvent = events[0]
  const connectionLabel = snapshot?.mode === 'live' ? 'Live node RPC' : 'Deterministic mock'
  const lastUpdated = snapshot
    ? new Date(snapshot.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'
  const isHealthy = !error && !stats?.rpcDegraded
  const syncLabel = stats?.syncState || (loading ? 'connecting' : 'unknown')
  const pollSeconds = Math.round(explorerApi.pollIntervalMs / 1_000)

  const networkSummary = useMemo(() => {
    if (!stats) return 'Waiting for node data'
    return `${stats.chainId} · ${stats.consensusMode}`
  }, [stats])

  function clearDetails() {
    setSelectedEvent(null)
    setSelectedTransaction(null)
    setSelectedAddress(null)
    setSelectedSearchResult(null)
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault()
    setSearching(true)
    setSearchMessage('')
    try {
      const matches = await explorerApi.search(query)
      setResults(matches)
      if (matches.length === 0) setSearchMessage('No block, transaction or address matched that value.')
    } catch (searchError) {
      setResults([])
      setSearchMessage(readableError(searchError))
    } finally {
      setSearching(false)
    }
  }

  async function openEvent(event: DagEvent) {
    clearDetails()
    setSelectedEvent(event)
    if (event.parents.length > 0) return

    setDetailLoading(true)
    try {
      const detailed = await explorerApi.getBlockOverview(event.id)
      if (detailed) setSelectedEvent(detailed)
    } catch (detailError) {
      setError(readableError(detailError))
    } finally {
      setDetailLoading(false)
    }
  }

  async function openBlock(hash: string) {
    const existing = events.find((event) => event.id === hash)
    if (existing) {
      await openEvent(existing)
      return
    }

    setDetailLoading(true)
    try {
      const detailed = await explorerApi.getBlockOverview(hash)
      if (detailed) {
        clearDetails()
        setSelectedEvent(detailed)
      }
    } catch (detailError) {
      setError(readableError(detailError))
    } finally {
      setDetailLoading(false)
    }
  }

  async function openTransaction(txid: string) {
    setDetailLoading(true)
    try {
      const transaction = await explorerApi.getTransaction(txid)
      clearDetails()
      setSelectedTransaction(transaction)
    } catch (detailError) {
      setError(readableError(detailError))
    } finally {
      setDetailLoading(false)
    }
  }

  async function openAddress(address: string) {
    setDetailLoading(true)
    try {
      const detail = await explorerApi.getAddress(address)
      clearDetails()
      setSelectedAddress(detail)
    } catch (detailError) {
      setError(readableError(detailError))
    } finally {
      setDetailLoading(false)
    }
  }

  async function openSearchResult(result: SearchResult) {
    setResults([])
    setSearchMessage('')
    setSelectedSearchResult(result)

    if (result.kind === 'block') {
      await openBlock(result.id)
      return
    }
    if (result.kind === 'transaction') {
      await openTransaction(result.id)
      return
    }
    if (result.kind === 'address') {
      await openAddress(result.id)
    }
  }

  function closeDrawer() {
    clearDetails()
  }

  const drawerOpen = Boolean(selectedEvent || selectedTransaction || selectedAddress || selectedSearchResult)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveView('overview')} aria-label="PulseDAG home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>PulseDAG</strong><small>EXPLORER</small></span>
        </button>

        <nav aria-label="Explorer navigation">
          <button className={activeView === 'overview' ? 'active' : ''} onClick={() => setActiveView('overview')}><span>⌁</span>Overview</button>
          <button className={activeView === 'blocks' ? 'active' : ''} onClick={() => setActiveView('blocks')}><span>◇</span>DAG blocks</button>
          <button className={activeView === 'node' ? 'active' : ''} onClick={() => setActiveView('node')}><span>◉</span>Node health</button>
        </nav>

        <div className="sidebar-footer">
          <div className={`network-indicator ${isHealthy ? '' : 'warning'}`}><i />Private testnet</div>
          <small>{connectionLabel}</small>
          <small>Refresh: {pollSeconds}s</small>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">Private-testnet intelligence</span>
            <h1>{activeView === 'overview' ? 'Overview' : activeView === 'blocks' ? 'DAG blocks' : 'Node health'}</h1>
          </div>
          <div className="topbar-actions">
            <span className={`sync-pill ${isHealthy ? '' : 'warning'}`}><i />{syncLabel} · {lastUpdated}</span>
            <button className="icon-button" onClick={() => void loadSnapshot(true)} aria-label="Refresh node data" disabled={refreshing}>
              {refreshing ? '···' : '↻'}
            </button>
            <button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
              {theme === 'dark' ? '☼' : '◐'}
            </button>
          </div>
        </header>

        {error && (
          <section className="notice notice-error" role="alert">
            <div><strong>Node connection unavailable</strong><span>{error}</span></div>
            <button onClick={() => void loadSnapshot()}>Retry</button>
          </section>
        )}

        {snapshot && snapshot.warnings.length > 0 && (
          <section className="notice notice-warning">
            <div><strong>Node reported warnings</strong><span>{snapshot.warnings.slice(0, 3).join(' · ')}</span></div>
          </section>
        )}

        <section className="search-panel">
          <div>
            <span className="eyebrow">Explore PulseDAG v2.3.0</span>
            <h2>Search the graph.</h2>
            <p>Resolve a block hash, transaction ID or known address through the stable read-only RPC.</p>
          </div>
          <form onSubmit={handleSearch}>
            <span>⌕</span>
            <input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Paste a hash, txid or address" aria-label="Search PulseDAG" />
            <button disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
            {(results.length > 0 || searchMessage) && (
              <div className="search-results">
                {results.map((result) => (
                  <button type="button" key={`${result.kind}-${result.id}`} onClick={() => void openSearchResult(result)}>
                    <strong>{result.title}</strong><small>{result.kind} · {result.subtitle}</small>
                  </button>
                ))}
                {searchMessage && <p>{searchMessage}</p>}
              </div>
            )}
          </form>
        </section>

        {loading && !snapshot && <section className="panel loading-panel">Connecting to PulseDAG…</section>}

        {activeView === 'overview' && snapshot && (
          <>
            <section className="metrics-grid">
              <MetricCard label="DAG height" value={number.format(stats?.dagHeight ?? 0)} detail={`${number.format(stats?.blockCount ?? 0)} accepted blocks`} />
              <MetricCard label="Connected peers" value={number.format(stats?.peerCount ?? 0)} detail={`${stats?.tipCount ?? 0} current DAG tips`} />
              <MetricCard label="Mempool" value={number.format(stats?.mempoolTransactions ?? 0)} detail={`${stats?.orphanTransactions ?? 0} orphan transactions`} />
              <MetricCard label="Block interval" value={stats?.blockIntervalSeconds ? `${stats.blockIntervalSeconds}s` : '—'} detail={`PoW health: ${stats?.powStatus ?? 'unknown'}`} />
            </section>

            <section className="dashboard-grid">
              <article className="panel dag-panel">
                <div className="panel-header">
                  <div><span className="eyebrow">Observed topology</span><h3>Recent accepted blocks</h3></div>
                  <span className="live-label"><i />Polling {pollSeconds}s</span>
                </div>
                <DagGraph events={events} onSelect={(event) => void openEvent(event)} />
                <div className="dag-legend"><span><i className="accepted" />Accepted</span><span>{latestEvent ? `Head ${latestEvent.shortId}` : 'No blocks returned'}</span><span>Click a vertex to inspect</span></div>
              </article>

              <article className="panel load-panel">
                <div className="panel-header"><div><span className="eyebrow">Derived indicator</span><h3>Operational pressure</h3></div><strong>{stats?.operationalPressure ?? 0}%</strong></div>
                <div className="load-ring" style={{ '--load': `${stats?.operationalPressure ?? 0}%` } as CSSProperties}><span>{stats?.lagBlocks ?? 0}<small>LAG BLOCKS</small></span></div>
                <div className="load-details">
                  <span><small>Difficulty</small><strong>{stats?.difficulty ? number.format(stats.difficulty) : '—'}</strong></span>
                  <span><small>Snapshot height</small><strong>{stats?.snapshotHeight !== null && stats?.snapshotHeight !== undefined ? number.format(stats.snapshotHeight) : '—'}</strong></span>
                </div>
              </article>
            </section>
          </>
        )}

        {(activeView === 'overview' || activeView === 'blocks') && snapshot && (
          <section className="panel table-panel">
            <div className="panel-header">
              <div><span className="eyebrow">Ledger feed</span><h3>Latest blocks</h3></div>
              <button className="text-button" onClick={() => setActiveView('blocks')}>View blocks →</button>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Block</th><th>Height</th><th>Age</th><th>Transactions</th><th>Blue score</th><th>Parents</th><th>Status</th></tr></thead>
                <tbody>{events.map((event) => (
                  <tr key={event.id} onClick={() => void openEvent(event)}>
                    <td><span className="hash">{event.shortId}</span></td>
                    <td>{number.format(event.height)}</td>
                    <td>{event.age}</td>
                    <td>{event.transactions}</td>
                    <td>{number.format(event.blueScore)}</td>
                    <td>{event.parentCount}</td>
                    <td><span className={`status status-${event.status}`}><i />{event.status}</span></td>
                  </tr>
                ))}</tbody>
              </table>
              {events.length === 0 && <p className="empty-state">The node returned no blocks.</p>}
            </div>
          </section>
        )}

        {activeView === 'node' && snapshot && (
          <section className="nodes-grid">
            {nodes.map((node) => (
              <article className="panel node-card" key={node.id}>
                <div className="node-card-header"><span className={`node-orb ${node.status}`} /><span className={`status status-${node.status === 'online' ? 'accepted' : node.status === 'degraded' ? 'rejected' : 'pending'}`}><i />{node.status}</span></div>
                <h3>{node.label}</h3><p>{networkSummary}</p>
                <dl>
                  <div><dt>Version</dt><dd>{node.version}</dd></div>
                  <div><dt>RPC round trip</dt><dd>{node.latencyMs} ms</dd></div>
                  <div><dt>Best height</dt><dd>{number.format(node.bestHeight)}</dd></div>
                  <div><dt>Connected peers</dt><dd>{node.peerCount}</dd></div>
                  <div><dt>Sync state</dt><dd>{node.syncState}</dd></div>
                  <div><dt>P2P mode</dt><dd>{node.p2pMode}</dd></div>
                  <div><dt>Storage</dt><dd>{node.storageBackend}</dd></div>
                  <div><dt>Chain ID</dt><dd className="wrap-hash">{node.chainId}</dd></div>
                </dl>
              </article>
            ))}
          </section>
        )}
      </main>

      {drawerOpen && (
        <div className="drawer-backdrop" onClick={closeDrawer}>
          <aside className="detail-drawer" onClick={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}>
            <button className="drawer-close" onClick={closeDrawer} aria-label="Close details">×</button>
            {detailLoading && <p className="drawer-loading">Loading linked RPC details…</p>}
            {selectedEvent ? (
              <>
                <span className="eyebrow">DAG block</span><h2>{selectedEvent.shortId}</h2>
                <span className={`status status-${selectedEvent.status}`}><i />{selectedEvent.status}</span>
                <dl>
                  <div><dt>Full hash</dt><dd className="wrap-hash">{selectedEvent.id}</dd></div>
                  <div><dt>Height</dt><dd>{number.format(selectedEvent.height)}</dd></div>
                  <div><dt>Blue score</dt><dd>{number.format(selectedEvent.blueScore)}</dd></div>
                  <div><dt>Timestamp</dt><dd>{new Date(selectedEvent.timestamp).toLocaleString()}</dd></div>
                  <div><dt>Transactions</dt><dd>{selectedEvent.transactions}</dd></div>
                  <div><dt>Parents</dt><dd>{selectedEvent.parents.length > 0 ? selectedEvent.parents.map((parent) => <span className="parent-hash" key={parent}>{parent}</span>) : `${selectedEvent.parentCount} parent reference(s)`}</dd></div>
                </dl>
              </>
            ) : selectedTransaction ? (
              <TransactionDetails
                transaction={selectedTransaction}
                onOpenTransaction={(txid) => void openTransaction(txid)}
                onOpenAddress={(address) => void openAddress(address)}
                onOpenBlock={(hash) => void openBlock(hash)}
              />
            ) : selectedAddress ? (
              <AddressDetails
                address={selectedAddress}
                onOpenTransaction={(txid) => void openTransaction(txid)}
                onOpenAddress={(address) => void openAddress(address)}
                onOpenBlock={(hash) => void openBlock(hash)}
              />
            ) : selectedSearchResult ? (
              <>
                <span className="eyebrow">Search result</span><h2>{selectedSearchResult.kind}</h2>
                <span className="status status-accepted"><i />{selectedSearchResult.status ?? 'known'}</span>
                <dl>
                  <div><dt>Identifier</dt><dd className="wrap-hash">{selectedSearchResult.id}</dd></div>
                  <div><dt>Kind</dt><dd>{selectedSearchResult.kind}</dd></div>
                  <div><dt>Block height</dt><dd>{selectedSearchResult.blockHeight === null ? '—' : number.format(selectedSearchResult.blockHeight)}</dd></div>
                  <div><dt>RPC summary</dt><dd>{selectedSearchResult.subtitle}</dd></div>
                </dl>
              </>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  )
}

export default App
