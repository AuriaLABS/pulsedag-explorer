import type { DagEvent } from '../types'

const number = new Intl.NumberFormat('en-US')

interface BlockDetailsProps {
  block: DagEvent
  onOpenBlock: (hash: string) => void
  onOpenTransaction: (txid: string) => void
}

export function BlockDetails({ block, onOpenBlock, onOpenTransaction }: BlockDetailsProps) {
  const txids = block.txids ?? []
  const confirmations = block.confirmations ?? null
  const isTip = block.isTip ?? null

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
      </dl>

      <section className="entity-section">
        <div className="entity-section-header">
          <span className="eyebrow">Parents</span>
          <strong>{block.parents.length}</strong>
        </div>
        {block.parents.length === 0 ? (
          <p className="entity-empty">No parent hashes were returned. This may be the genesis block.</p>
        ) : (
          <div className="entity-list">
            {block.parents.map((parent) => (
              <button className="entity-row" key={parent} onClick={() => onOpenBlock(parent)}>
                <span className="wrap-hash">{parent}</span>
                <small>Open parent block</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="entity-section">
        <div className="entity-section-header">
          <span className="eyebrow">Transactions</span>
          <strong>{txids.length}</strong>
        </div>
        {txids.length === 0 ? (
          <p className="entity-empty">No transaction identifiers were returned for this block overview.</p>
        ) : (
          <div className="entity-list">
            {txids.map((txid) => (
              <button className="entity-row" key={txid} onClick={() => onOpenTransaction(txid)}>
                <span className="wrap-hash">{txid}</span>
                <small>Open transaction</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
