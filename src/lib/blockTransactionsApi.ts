import type { BlockTransactionPage } from '../types'

interface ApiEnvelope<T> {
  ok: boolean
  data: T | null
  error: { code: string; message: string } | null
  meta: Record<string, unknown>
}

interface BlockTransactionsData {
  block_hash: string
  block_height: number
  count: number
  total: number
  limit: number
  offset: number
  has_more: boolean
  context: string
  transactions: Array<{
    txid: string
    fee: number
    inputs: number
    outputs: number
    context: string
    is_confirmed: boolean
    is_mempool: boolean
  }>
}

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/rpc').replace(/\/$/, '')
const apiRoot = rawBaseUrl.endsWith('/api/v1') ? rawBaseUrl : `${rawBaseUrl}/api/v1`

function bounded(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

export const blockTransactionsApi = {
  async getPage(hash: string, limit: number, offset: number): Promise<BlockTransactionPage> {
    const safeLimit = bounded(limit, 20, 1, 100)
    const safeOffset = bounded(offset, 0, 0, Number.MAX_SAFE_INTEGER)
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 5_000)

    try {
      const response = await fetch(`${apiRoot}/blocks/${encodeURIComponent(hash)}/transactions?limit=${safeLimit}&offset=${safeOffset}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`PulseDAG RPC returned HTTP ${response.status}`)
      const envelope = (await response.json()) as ApiEnvelope<BlockTransactionsData>
      if (!envelope.ok || envelope.data === null) {
        throw new Error(envelope.error?.message || 'PulseDAG RPC returned an empty block transaction page')
      }
      const data = envelope.data
      return {
        blockHash: data.block_hash,
        blockHeight: data.block_height,
        count: data.count,
        total: data.total,
        limit: data.limit,
        offset: data.offset,
        hasMore: data.has_more,
        context: data.context,
        transactions: data.transactions.map((transaction) => ({
          txid: transaction.txid,
          fee: transaction.fee,
          inputs: transaction.inputs,
          outputs: transaction.outputs,
          context: transaction.context,
          isConfirmed: transaction.is_confirmed,
          isMempool: transaction.is_mempool,
        })),
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('PulseDAG block transaction request timed out')
      }
      throw error
    } finally {
      window.clearTimeout(timeoutId)
    }
  },
}
