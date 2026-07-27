import { PaginationControls } from './PaginationControls'
import type { TransactionActivityPage } from '../types'

const number = new Intl.NumberFormat('en-US')

interface TransactionActivityPanelProps {
  page: TransactionActivityPage | null
  loading: boolean
  error: string
  onOpenTransaction: (txid: string) => void
  onOpenBlock: (hash: string) => void
  onPageChange: (limit: number, offset: number) => void
  onRetry: () => void
}

export function TransactionActivityPanel({
  page,
  loading,
  error,
  onOpenTransaction,
  onOpenBlock,
  onPageChange,
  onRetry,
}: TransactionActivityPanelProps) {
  const pendingOnPage = page?.transactions.filter((transaction) => transaction.isMempool).length ?? 0
  const confirmedOnPage = page?.transactions.filter((transaction) => transaction.isConfirmed).length ?? 0
  const pageNumber = page ? Math.floor(page.offset / page.limit) + 1 : null

  return (
    <section className="transaction-activity-layout">
      <div className="entity-stats transaction-activity-stats">
        <div><small>Total activity</small><strong>{page ? number.format(page.total) : '—'}</strong></div>
        <div><small>Pending on page</small><strong>{page ? number.format(pendingOnPage) : '—'}</strong></div>
        <div><small>Confirmed on page</small><strong>{page ? number.format(confirmedOnPage) : '—'}</strong></div>
        <div><small>Current page</small><strong>{pageNumber === null ? '—' : number.format(pageNumber)}</strong></div>
      </div>

      <article className="panel table-panel transaction-activity-panel">
        <div className="panel-header">
          <div><span className="eyebrow">Network ledger activity</span><h3>Pending and confirmed transactions</h3></div>
          <span className="live-label"><i />Read-only RPC</span>
        </div>

        {loading && <p className="empty-state">Loading transaction activity…</p>}
        {error && (
          <div className="entity-page-error transaction-activity-error" role="alert">
            <strong>Unable to load transaction activity</strong>
            <span>{error}</span>
            <button onClick={onRetry}>Retry</button>
          </div>
        )}

        {!loading && !error && page && (
          <>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Transaction</th><th>Context</th><th>Fee</th><th>Inputs</th><th>Outputs</th><th>Block</th></tr></thead>
                <tbody>
                  {page.transactions.map((transaction) => (
                    <tr key={transaction.txid} onClick={() => onOpenTransaction(transaction.txid)}>
                      <td><span className="hash">{transaction.txid}</span></td>
                      <td><span className={`status status-${transaction.isMempool ? 'pending' : 'accepted'}`}><i />{transaction.context}</span></td>
                      <td>{number.format(transaction.fee)}</td>
                      <td>{number.format(transaction.inputs)}</td>
                      <td>{number.format(transaction.outputs)}</td>
                      <td>
                        {transaction.blockHash ? (
                          <button
                            className="entity-link transaction-block-link"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpenBlock(transaction.blockHash as string)
                            }}
                          >
                            {transaction.blockHeight === null ? 'Open block' : `#${number.format(transaction.blockHeight)}`}
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {page.transactions.length === 0 && <p className="empty-state">No transaction activity exists on this page.</p>}
            </div>
            <PaginationControls
              count={page.count}
              total={page.total}
              limit={page.limit}
              offset={page.offset}
              hasMore={page.hasMore}
              label="Transaction activity"
              disabled={loading}
              onChange={onPageChange}
            />
          </>
        )}
      </article>
    </section>
  )
}
