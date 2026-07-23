interface PaginationControlsProps {
  count: number
  total: number
  limit: number
  offset: number
  hasMore: boolean
  label: string
  disabled?: boolean
  onChange: (limit: number, offset: number) => void
}

const pageSizes = [10, 20, 50, 100]

export function PaginationControls({
  count,
  total,
  limit,
  offset,
  hasMore,
  label,
  disabled = false,
  onChange,
}: PaginationControlsProps) {
  const start = count === 0 ? 0 : offset + 1
  const end = offset + count
  const page = Math.floor(offset / limit) + 1
  const pageCount = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="pagination-controls" aria-label={`${label} pagination`}>
      <div className="pagination-summary">
        <strong>{label}</strong>
        <span>{start}–{end} of {total} · Page {page} of {pageCount}</span>
      </div>
      <label className="pagination-size">
        <span>Rows</span>
        <select
          value={limit}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value), 0)}
        >
          {pageSizes.map((size) => <option value={size} key={size}>{size}</option>)}
        </select>
      </label>
      <div className="pagination-actions">
        <button disabled={disabled || offset === 0} onClick={() => onChange(limit, Math.max(0, offset - limit))}>← Previous</button>
        <button disabled={disabled || !hasMore} onClick={() => onChange(limit, offset + limit)}>Next →</button>
      </div>
    </div>
  )
}
