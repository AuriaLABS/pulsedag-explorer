import type { AddressDetail, TransactionDetail } from '../types'
import { PaginationControls } from './PaginationControls'

const number = new Intl.NumberFormat('en-US')

interface EntityNavigationProps {
  onOpenTransaction: (txid: string) => void
  onOpenAddress: (address: string) => void
  onOpenBlock: (hash: string) => void
}

interface TransactionDetailsProps extends EntityNavigationProps {
  transaction: TransactionDetail
}

interface AddressDetailsProps extends EntityNavigationProps {
  address: AddressDetail
  onActivityPageChange: (limit: number, offset: number) => void
  pageLoading?: boolean
}

function amount(value: number): string {
  return number.format(value)
}

export function TransactionDetails({
  transaction,
  onOpenAddress,
  onOpenBlock,
  onOpenTransaction,
}: TransactionDetailsProps) {
  return (
    <>
      <span className="eyebrow">Transaction</span>
      <h2 className="entity-title">{transaction.txid.slice(0, 12)}…</h2>
      <span className={`status status-${transaction.isConfirmed ? 'accepted' : 'pending'}`}>
        <i />{transaction.status}
      </span>

      <dl>
        <div><dt>Transaction ID</dt><dd className="wrap-hash">{transaction.txid}</dd></div>
        <div><dt>Fee</dt><dd>{amount(transaction.fee)}</dd></div>
        <div><dt>Nonce</dt><dd>{number.format(transaction.nonce)}</dd></div>
        <div><dt>Confirmations</dt><dd>{transaction.confirmations === null ? '—' : number.format(transaction.confirmations)}</dd></div>
        <div>
          <dt>Block</dt>
          <dd>
            {transaction.blockHash ? (
              <button className="entity-link wrap-hash" onClick={() => onOpenBlock(transaction.blockHash!)}>
                {transaction.blockHash}
              </button>
            ) : 'Mempool'}
          </dd>
        </div>
        <div><dt>Block height</dt><dd>{transaction.blockHeight === null ? '—' : number.format(transaction.blockHeight)}</dd></div>
      </dl>

      <section className="entity-section">
        <div className="entity-section-header">
          <span className="eyebrow">Inputs</span>
          <strong>{transaction.inputs.length}</strong>
        </div>
        {transaction.inputs.length === 0 ? (
          <p className="entity-empty">No previous outpoints. This is a genesis or coinbase-style transaction.</p>
        ) : (
          <div className="entity-list">
            {transaction.inputs.map((input) => (
              <button className="entity-row" key={`${input.txid}-${input.index}`} onClick={() => onOpenTransaction(input.txid)}>
                <span className="wrap-hash">{input.txid}</span>
                <small>Output #{input.index}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="entity-section">
        <div className="entity-section-header">
          <span className="eyebrow">Outputs</span>
          <strong>{transaction.outputs.length}</strong>
        </div>
        <div className="entity-list">
          {transaction.outputs.map((output, index) => (
            <button className="entity-row" key={`${output.address}-${index}`} onClick={() => onOpenAddress(output.address)}>
              <span className="wrap-hash">{output.address}</span>
              <strong>{amount(output.amount)}</strong>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}

export function AddressDetails({
  address,
  onOpenBlock,
  onOpenTransaction,
  onActivityPageChange,
  pageLoading = false,
}: AddressDetailsProps) {
  return (
    <>
      <span className="eyebrow">Address</span>
      <h2 className="entity-title wrap-hash">{address.address}</h2>
      <span className="status status-accepted"><i />known</span>

      <div className="entity-stats">
        <div><small>Confirmed balance</small><strong>{amount(address.confirmedBalance)}</strong></div>
        <div><small>Confirmed UTXOs</small><strong>{number.format(address.confirmedUtxoCount)}</strong></div>
        <div><small>Pending net</small><strong>{address.pendingNet > 0 ? '+' : ''}{amount(address.pendingNet)}</strong></div>
        <div><small>Mempool txs</small><strong>{number.format(address.mempoolTxCount)}</strong></div>
      </div>

      <dl>
        <div><dt>Address</dt><dd className="wrap-hash">{address.address}</dd></div>
        <div><dt>Pending incoming</dt><dd>{amount(address.pendingIncoming)}</dd></div>
        <div><dt>Pending outgoing</dt><dd>{amount(address.pendingOutgoing)}</dd></div>
        <div><dt>Mempool explicit</dt><dd>{address.mempoolExplicit ? 'yes' : 'no'}</dd></div>
      </dl>

      <section className="entity-section">
        <div className="entity-section-header">
          <span className="eyebrow">Activity</span>
          <strong>{number.format(address.activityTotal)}</strong>
        </div>
        {address.activity.length === 0 ? (
          <p className="entity-empty">No confirmed or mempool activity was returned for this page.</p>
        ) : (
          <div className="entity-list">
            {address.activity.map((item) => (
              <article className="activity-row" key={`${item.txid}-${item.context}`}>
                <div className="activity-row-main">
                  <button className="entity-link wrap-hash" onClick={() => onOpenTransaction(item.txid)}>{item.txid}</button>
                  <span className={`status status-${item.isConfirmed ? 'accepted' : 'pending'}`}><i />{item.direction}</span>
                </div>
                <div className="activity-values">
                  <span><small>Incoming</small><strong>{amount(item.incoming)}</strong></span>
                  <span><small>Outgoing</small><strong>{amount(item.outgoing)}</strong></span>
                  <span><small>Net</small><strong>{item.net > 0 ? '+' : ''}{amount(item.net)}</strong></span>
                </div>
                {item.blockHash && (
                  <button className="entity-link activity-block" onClick={() => onOpenBlock(item.blockHash!)}>
                    Block {item.blockHeight === null ? '' : `#${number.format(item.blockHeight)}`}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
        <PaginationControls
          count={address.activityCount ?? address.activity.length}
          total={address.activityTotal}
          limit={address.activityLimit ?? 20}
          offset={address.activityOffset ?? 0}
          hasMore={address.activityHasMore}
          label="Address activity"
          disabled={pageLoading}
          onChange={onActivityPageChange}
        />
      </section>
    </>
  )
}
