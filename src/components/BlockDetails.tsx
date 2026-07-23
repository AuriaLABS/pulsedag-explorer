import { useEffect, useState } from 'react'
import { blockTransactionsApi } from '../lib/blockTransactionsApi'
import { PaginationControls } from './PaginationControls'
import type { BlockTransactionPage, DagEvent } from '../types'

const number = new Intl.NumberFormat('en-US')
const DEFAULT_LIMIT = 20

interface BlockDetailsProps {
  block: DagEvent
  onOpenBlock: (hash: string) => void
  onOpenTransaction: (txid: string) => void
}

function readPagination(): { limit: number; offset: number } {
  const params = new URLSearchParams(window.location.search)
  const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || DEFAULT_LIMIT))
  const offset = Math.max(0, Number(params.get('offset')) || 0)
  return { limit: Math.trunc(limit), offset: Math.trunc(offset) }
}

export function BlockDetails({ block, onOpenBlock, onOpenTransaction }: BlockDetailsProps) {
  const confirmations = block.confirmations ?? null
  const isTip = block.isTip ?? null
  const children = block.childHashes ?? []
  const [pagination, setPagination] = useState(readPagination)
  const [page, setPage] = useState<BlockTransactionPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void blockTransactionsApi.getPage(block.id, pagination.limit, pagination.offset)
      .then((nextPage) => { if (!cancelled) setPage(nextPage) })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load block transactions')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [block.id, pagination.limit, pagination.offset, retryToken])

  function changePage(limit: number, offset: number) {
    const next = { limit, offset }
    const params = new URLSearchParams()
    if (limit !== DEFAULT_LIMIT) params.set('limit', String(limit))
    if (offset > 0) params.set('offset', String(offset))
    const query = params.toString()
    window.history.pushState({ pulsedag: true }, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
    setPagination(next)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  return (
    <>
      <span className="eyebrow">DAG block</span>
      <h2 className="entity-title">{block.shortId}</h2>
      <span className={`status status-${block.status}`}><i />{block.status}</span>

      <div className="entity-stats">
        <div><small>Height</small><strong>{number.format(block.height)}</strong></div>
        <div><small>Blue score</small><strong>{number.format(block.blueScore)}</strong></div>
        <div><small>Transactions</small><strong>{number.format(block.transactions)}</strong></div>
        <div><small>Confirmations</small><strong>{confirmations === null ? '—' : number.format(confirmations)}</strong></div>
      </div>

      <dl>
        <div><dt>Block hash</dt><dd className="wrap-hash">{block.id}</dd></div>
        <div><dt>Timestamp</dt><dd>{new Date(block.timestamp).toLocaleString()}</dd></div>
        <div><dt>DAG tip</dt><dd>{isTip === null ? '—' : isTip ? 'yes' : 'no'}</dd></div>
        <div><dt>Parents</dt><dd>{number.format(block.parentCount)}</dd></div>
        <div><dt>Children</dt><dd>{number.format(children.length)}</dd></div>
      </dl>

      <section className="entity-section">
        <div className="entity-section-header"><span className="eyebrow">Parents</span><strong>{block.parents.length}</strong></div>
        {block.parents.length === 0 ? <p className="entity-empty">No parent hashes were returned. This may be the genesis block.</p> : (
          <div className="entity-list">{block.parents.map((parent) => (
            <button className="entity-row" key={parent} onClick={() => onOpenBlock(parent)}><span className="wrap-hash">{parent}</span><small>Open parent block</small></button>
          ))}</div>
        )}
      </section>

      <section className="entity-section">
        <div className="entity-section-header"><span className="eyebrow">Children</span><strong>{children.length}</strong></div>
        {children.length === 0 ? <p className="entity-empty">No child blocks are currently linked to this block.</p> : (
          <div className="entity-list">{children.map((child) => (
            <button className="entity-row" key={child} onClick={() => onOpenBlock(child)}><span className="wrap-hash">{child}</span><small>Open child block</small></button>
          ))}</div>
        )}
      </section>

      <section className="entity-section">
        <div className="entity-section-header"><span className="eyebrow">Transactions</span><strong>{page ? number.format(page.total) : number.format(block.transactions)}</strong></div>
        {loading && <p className="entity-empty">Loading transaction page…</p>}
        {error && <div className="entity-page-error"><strong>Unable to load transactions</strong><span>{error}</span><button onClick={() => setRetryToken((value) => value + 1)}>Retry</button></div>}
        {!loading && !error && page && page.transactions.length === 0 && <p className="entity-empty">No transactions exist on this page.</p>}
        {!loading && !error && page && page.transactions.length > 0 && (
          <div className="entity-list">{page.transactions.map((transaction) => (
            <button className="entity-row block-transaction-row" key={transaction.txid} onClick={() => onOpenTransaction(transaction.txid)}>
              <span className="wrap-hash">{transaction.txid}</span>
              <small>{number.format(transaction.fee)} fee · {transaction.inputs} inputs · {transaction.outputs} outputs</small>
            </button>
          ))}</div>
        )}
        {page && (
          <PaginationControls
            count={page.count}
            total={page.total}
            limit={page.limit}
            offset={page.offset}
            hasMore={page.hasMore}
            label="transactions"
            onChange={changePage}
            disabled={loading}
          />
        )}
      </section>
    </>
  )
}
