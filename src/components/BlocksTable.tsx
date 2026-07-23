import type { BlockPage, DagEvent } from '../types'
import { PaginationControls } from './PaginationControls'

const number = new Intl.NumberFormat('en-US')

interface BlocksTableProps {
  events: DagEvent[]
  page?: BlockPage | null
  loading?: boolean
  error?: string
  onOpenBlock: (hash: string) => void
  onPageChange?: (limit: number, offset: number) => void
  onRetry?: () => void
}

export function BlocksTable({
  events,
  page,
  loading = false,
  error = '',
  onOpenBlock,
  onPageChange,
  onRetry,
}: BlocksTableProps) {
  const rows = page?.blocks ?? events

  return (
    <>
      {error && (
        <div className="inline-page-error" role="alert">
          <span>{error}</span>
          {onRetry && <button onClick={onRetry}>Retry</button>}
        </div>
      )}
      <div className={`table-scroll ${loading ? 'is-loading' : ''}`}>
        <table>
          <thead><tr><th>Block</th><th>Height</th><th>Age</th><th>Transactions</th><th>Blue score</th><th>Parents</th><th>Status</th></tr></thead>
          <tbody>{rows.map((event) => (
            <tr key={event.id} onClick={() => onOpenBlock(event.id)}>
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
        {!loading && rows.length === 0 && <p className="empty-state">The node returned no blocks for this page.</p>}
      </div>
      {page && onPageChange && (
        <PaginationControls
          count={page.count}
          total={page.total}
          limit={page.limit}
          offset={page.offset}
          hasMore={page.hasMore}
          label="DAG blocks"
          disabled={loading}
          onChange={onPageChange}
        />
      )}
    </>
  )
}
