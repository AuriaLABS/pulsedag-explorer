import { explorerApi } from './api'
import type { TransactionActivityPage } from '../types'

interface ApiEnvelope<T> {
  ok: boolean
  data: T | null
  error: { code: string; message: string } | null
  meta: Record<string, unknown>
}

interface TransactionActivityData {
  count: number
  total: number
  limit: number
  offset: number
  has_more: boolean
  transactions: Array<{
    txid: string
    fee: number
    inputs: number
    outputs: number
    context: string
    is_mempool: boolean
    is_confirmed: boolean
    block_hash: string | null
    block_height: number | null
  }>
}

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/rpc').replace(/\/$/, '')
const apiRoot = rawBaseUrl.endsWith('/api/v1') ? rawBaseUrl : `${rawBaseUrl}/api/v1`

async function request(path: string): Promise<TransactionActivityData> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetch(`${apiRoot}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`PulseDAG RPC returned HTTP ${response.status}`)

    const envelope = (await response.json()) as ApiEnvelope<TransactionActivityData>
    if (!envelope.ok || envelope.data === null) {
      throw new Error(envelope.error?.message || 'PulseDAG RPC returned an empty transaction activity response')
    }
    return envelope.data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('PulseDAG transaction activity request timed out')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function emptyMockPage(limit: number, offset: number): TransactionActivityPage {
  return {
    count: 0,
    total: 0,
    limit,
    offset,
    hasMore: false,
    transactions: [],
  }
}

export const transactionActivityApi = {
  async getPage(limit: number, offset: number): Promise<TransactionActivityPage> {
    if (!explorerApi.isLiveMode) return emptyMockPage(limit, offset)

    const page = await request(`/txs/activity?limit=${limit}&offset=${offset}`)
    return {
      count: page.count,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.has_more,
      transactions: page.transactions.map((transaction) => ({
        txid: transaction.txid,
        fee: transaction.fee,
        inputs: transaction.inputs,
        outputs: transaction.outputs,
        context: transaction.context,
        isMempool: transaction.is_mempool,
        isConfirmed: transaction.is_confirmed,
        blockHash: transaction.block_hash,
        blockHeight: transaction.block_height,
      })),
    }
  },
}
