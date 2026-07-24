import { PaginationControls } from './PaginationControls'
import type { MempoolPage } from '../types'

const number = new Intl.NumberFormat('en-US')

interface MempoolPanelProps {
  page: MempoolPage | null
  loading: boolean
  error: string
  onOpenTransaction: (txid: string) => void
  onPageChange: (limit: number, offset: number) => void
  onRetry: () => void
}

export function MempoolPanel({
  page,
  loading,
  error,
  onOpenTransaction,
  onPageChange,
  onRetry,
}: MempoolPanelProps) {
  return (
    <section className="mempool-layout">
      <div className="entity-stats mempool-stats">
        <div><small>Pending transactions</small><strong>{page ? number.format(page.transactionCount) : '—'}</strong></div>
        <div><small>Orphan transactions</small><strong>{page ? number.format(page.orphanTransactionCount) : '—'}</strong></div>
        <div><small>Spent outpoints</small><strong>{page ? number.format(page.spentOutpointsCount) : '—'}</strong></div>
        <div><small>Orphan capacity</small><strong>{page ? number.format(page.orphanLimit) : '—'}</strong></div>
      </div>

      <article className="panel table-panel mempool-panel">
        <div className="panel-header">
          <div><span className="eyebrow">Pending ledger activity</span><h3>Transactions by fee</h3></div>
          <span className="live-label"><i />Read-only RPC</span>
        </div>

        {loading && <p className="empty-state">Loading mempool transactions…</p>}
        {error && (
          <div className="entity-page-error mempool-error" role="alert">
            <strong>Unable to load mempool</strong>
            <span>{error}</span>
            <button onClick={onRetry}>Retry</button>
          </div>
        )}

        {!loading && !error && page && (
          <>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Transaction</th><th>Fee</th><th>Inputs</th><th>Outputs</th><th>Status</th></tr></thead>
                <tbody>
                  {page.transactions.map((transaction) => (
                    <tr key={transaction.txid} onClick={() => onOpenTransaction(transaction.txid)}>
                      <td><span className="hash">{transaction.txid}</span></td>
                      <td>{number.format(transaction.fee)}</td>
                      <td>{number.format(transaction.inputs)}</td>
                      <td>{number.format(transaction.outputs)}</td>
                      <td><span className="status status-pending"><i />mempool</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {page.transactions.length === 0 && <p className="empty-state">The node currently reports an empty mempool.</p>}
            </div>
            <PaginationControls
              count={page.count}
              total={page.total}
              limit={page.limit}
              offset={page.offset}
              hasMore={page.hasMore}
              label="Mempool transactions"
              disabled={loading}
              onChange={onPageChange}
            />
          </>
        )}
      </article>

      {page && (
        <article className="panel mempool-counters">
          <div className="panel-header"><div><span className="eyebrow">Orphan lifecycle</span><h3>Observed counters</h3></div></div>
          <dl>
            <div><dt>Orphaned total</dt><dd>{number.format(page.orphanedTotal)}</dd></div>
            <div><dt>Promoted total</dt><dd>{number.format(page.orphanPromotedTotal)}</dd></div>
            <div><dt>Dropped total</dt><dd>{number.format(page.orphanDroppedTotal)}</dd></div>
            <div><dt>Pruned total</dt><dd>{number.format(page.orphanPrunedTotal)}</dd></div>
          </dl>
        </article>
      )}
    </section>
  )
}
