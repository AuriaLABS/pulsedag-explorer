import { type ChangeEvent, type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { BlockDetails } from './components/BlockDetails'
import { BlocksTable } from './components/BlocksTable'
import { DagGraph } from './components/DagGraph'
import { AddressDetails, TransactionDetails } from './components/EntityDetails'
import { MetricCard } from './components/MetricCard'
import { explorerApi } from './lib/api'
import { blockDetailsApi } from './lib/blockDetails'
import { paginationApi } from './lib/paginationApi'
import {
  DEFAULT_PAGE_LIMIT,
  explorerRouteHeading,
  explorerRoutePath,
  explorerRouteTitle,
  parseExplorerRoute,
  type DashboardView,
  type ExplorerRoute,
} from './lib/routes'
import type { AddressDetail, BlockPage, DagEvent, ExplorerSnapshot, SearchResult, TransactionDetail } from './types'

const number = new Intl.NumberFormat('en-US')

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load PulseDAG data'
}

function App() {
  const [snapshot, setSnapshot] = useState<ExplorerSnapshot | null>(null)
  const [blockPage, setBlockPage] = useState<BlockPage | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<DagEvent | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<AddressDetail | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchMessage, setSearchMessage] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [route, setRoute] = useState<ExplorerRoute>(() => parseExplorerRoute(window.location.pathname, window.location.search))
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [blockPageLoading, setBlockPageLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [blockPageError, setBlockPageError] = useState('')
  const [copyMessage, setCopyMessage] = useState('Copy link')

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

  useEffect(() => {
    const handlePopState = () => setRoute(parseExplorerRoute(window.location.pathname, window.location.search))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    document.title = explorerRouteTitle(route)
  }, [route])

  useEffect(() => {
    let cancelled = false

    if (route.kind !== 'dashboard' || route.view !== 'blocks') {
      setBlockPage(null)
      setBlockPageError('')
      setBlockPageLoading(false)
      return () => { cancelled = true }
    }

    setBlockPageLoading(true)
    setBlockPageError('')
    const loadPage = async () => {
      try {
        const page = await paginationApi.getBlocks(route.pagination.limit, route.pagination.offset)
        if (!cancelled) setBlockPage(page)
      } catch (loadError) {
        if (!cancelled) setBlockPageError(readableError(loadError))
      } finally {
        if (!cancelled) setBlockPageLoading(false)
      }
    }

    void loadPage()
    return () => { cancelled = true }
  }, [route])

  useEffect(() => {
    let cancelled = false

    setSelectedEvent(null)
    setSelectedTransaction(null)
    setSelectedAddress(null)
    setDetailError('')
    setCopyMessage('Copy link')

    if (route.kind === 'dashboard' || route.kind === 'not-found') {
      setDetailLoading(false)
      return () => { cancelled = true }
    }

    setDetailLoading(true)
    const loadEntity = async () => {
      try {
        if (route.kind === 'block') {
          const block = await blockDetailsApi.getBlock(route.id)
          if (!block) throw new Error('The requested block was not found')
          if (!cancelled) setSelectedEvent(block)
        } else if (route.kind === 'transaction') {
          const transaction = await explorerApi.getTransaction(route.id)
          if (!cancelled) setSelectedTransaction(transaction)
        } else {
          const address = await paginationApi.getAddress(route.id, route.pagination.limit, route.pagination.offset)
          if (!cancelled) setSelectedAddress(address)
        }
      } catch (loadError) {
        if (!cancelled) setDetailError(readableError(loadError))
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }

    void loadEntity()
    return () => { cancelled = true }
  }, [route])

  const stats = snapshot?.stats
  const events = snapshot?.events ?? []
  const nodes = snapshot?.nodes ?? []
  const latestEvent = events[0]
  const dashboardView = route.kind === 'dashboard' ? route.view : null
  const connectionLabel = snapshot?.mode === 'live' ? 'Live node RPC' : 'Deterministic mock'
  const lastUpdated = snapshot
    ? new Date(snapshot.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'
  const isHealthy = !error && !stats?.rpcDegraded
  const syncLabel = stats?.syncState || (loading ? 'connecting' : 'unknown')
  const pollSeconds = Math.round(explorerApi.pollIntervalMs / 1_000)
  const isEntityRoute = route.kind === 'block' || route.kind === 'transaction' || route.kind === 'address'

  const networkSummary = useMemo(() => {
    if (!stats) return 'Waiting for node data'
    return `${stats.chainId} · ${stats.consensusMode}`
  }, [stats])

  function goTo(nextRoute: ExplorerRoute, replace = false) {
    const path = explorerRoutePath(nextRoute)
    if (replace) window.history.replaceState({ pulsedag: true }, '', path)
    else window.history.pushState({ pulsedag: true }, '', path)
    setRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goToDashboard(view: DashboardView) {
    if (view === 'blocks') {
      goTo({ kind: 'dashboard', view: 'blocks', pagination: { limit: DEFAULT_PAGE_LIMIT, offset: 0 } })
    } else {
      goTo({ kind: 'dashboard', view })
    }
  }

  function leaveEntityPage() {
    if (window.history.state?.pulsedag) window.history.back()
    else goToDashboard('overview')
  }

  async function copyCurrentLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyMessage('Link copied')
    } catch {
      setCopyMessage('Copy unavailable')
    }
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

  function openBlock(hash: string) {
    goTo({ kind: 'block', id: hash })
  }

  function openTransaction(txid: string) {
    goTo({ kind: 'transaction', id: txid })
  }

  function openAddress(address: string) {
    goTo({ kind: 'address', id: address, pagination: { limit: DEFAULT_PAGE_LIMIT, offset: 0 } })
  }

  function openSearchResult(result: SearchResult) {
    setResults([])
    setSearchMessage('')
    if (result.kind === 'block') openBlock(result.id)
    else if (result.kind === 'transaction') openTransaction(result.id)
    else openAddress(result.id)
  }

  function changeBlockPage(limit: number, offset: number) {
    goTo({ kind: 'dashboard', view: 'blocks', pagination: { limit, offset } })
  }

  function changeAddressPage(limit: number, offset: number) {
    if (route.kind !== 'address') return
    goTo({ kind: 'address', id: route.id, pagination: { limit, offset } })
  }

  function retryEntityRoute() {
    setRoute(parseExplorerRoute(window.location.pathname, window.location.search))
  }

  function retryBlockPage() {
    setRoute(parseExplorerRoute(window.location.pathname, window.location.search))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => goToDashboard('overview')} aria-label="PulseDAG home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>PulseDAG</strong><small>EXPLORER</small></span>
        </button>

        <nav aria-label="Explorer navigation">
          <button className={dashboardView === 'overview' ? 'active' : ''} onClick={() => goToDashboard('overview')}><span>⌁</span>Overview</button>
          <button className={dashboardView === 'blocks' ? 'active' : ''} onClick={() => goToDashboard('blocks')}><span>◇</span>DAG blocks</button>
          <button className={dashboardView === 'node' ? 'active' : ''} onClick={() => goToDashboard('node')}><span>◉</span>Node health</button>
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
            <h1>{explorerRouteHeading(route)}</h1>
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
                  <button type="button" key={`${result.kind}-${result.id}`} onClick={() => openSearchResult(result)}>
                    <strong>{result.title}</strong><small>{result.kind} · {result.subtitle}</small>
                  </button>
                ))}
                {searchMessage && <p>{searchMessage}</p>}
              </div>
            )}
          </form>
        </section>

        {loading && !snapshot && dashboardView && <section className="panel loading-panel">Connecting to PulseDAG…</section>}

        {dashboardView === 'overview' && snapshot && (
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
                <DagGraph events={events} onSelect={(event) => openBlock(event.id)} />
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

        {((dashboardView === 'overview' && snapshot) || dashboardView === 'blocks') && (
          <section className="panel table-panel">
            <div className="panel-header">
              <div><span className="eyebrow">Ledger feed</span><h3>{dashboardView === 'blocks' ? 'Paginated blocks' : 'Latest blocks'}</h3></div>
              {dashboardView === 'overview' && <button className="text-button" onClick={() => goToDashboard('blocks')}>View blocks →</button>}
            </div>
            <BlocksTable
              events={events}
              page={dashboardView === 'blocks' ? blockPage : undefined}
              loading={dashboardView === 'blocks' && blockPageLoading}
              error={dashboardView === 'blocks' ? blockPageError : ''}
              onOpenBlock={openBlock}
              onPageChange={dashboardView === 'blocks' ? changeBlockPage : undefined}
              onRetry={dashboardView === 'blocks' ? retryBlockPage : undefined}
            />
          </section>
        )}

        {dashboardView === 'node' && snapshot && (
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

        {isEntityRoute && (
          <section className="entity-page">
            <div className="entity-page-toolbar">
              <button className="entity-page-action" onClick={leaveEntityPage}>← Back to explorer</button>
              <span className="entity-route-path">{explorerRoutePath(route)}</span>
              <button className="entity-page-action" onClick={() => void copyCurrentLink()}>{copyMessage}</button>
            </div>
            <article className="panel entity-page-card">
              {detailLoading && <p className="entity-page-loading">Loading linked RPC details…</p>}
              {detailError && (
                <div className="entity-page-error" role="alert">
                  <strong>Unable to load this entity</strong>
                  <span>{detailError}</span>
                  <button onClick={retryEntityRoute}>Retry</button>
                </div>
              )}
              {!detailLoading && !detailError && selectedEvent && (
                <BlockDetails block={selectedEvent} onOpenBlock={openBlock} onOpenTransaction={openTransaction} />
              )}
              {!detailLoading && !detailError && selectedTransaction && (
                <TransactionDetails transaction={selectedTransaction} onOpenTransaction={openTransaction} onOpenAddress={openAddress} onOpenBlock={openBlock} />
              )}
              {!detailLoading && !detailError && selectedAddress && (
                <AddressDetails
                  address={selectedAddress}
                  onOpenTransaction={openTransaction}
                  onOpenAddress={openAddress}
                  onOpenBlock={openBlock}
                  onActivityPageChange={changeAddressPage}
                  pageLoading={detailLoading}
                />
              )}
            </article>
          </section>
        )}

        {route.kind === 'not-found' && (
          <section className="panel not-found-panel">
            <span className="eyebrow">Unknown explorer route</span>
            <h2>Nothing exists at this URL.</h2>
            <p className="wrap-hash">{route.path}</p>
            <button className="entity-page-action" onClick={() => goToDashboard('overview')}>Return to overview</button>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
