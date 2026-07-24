import { explorerApi } from './api'
import type { MempoolPage } from '../types'

interface ApiEnvelope<T> {
  ok: boolean
  data: T | null
  error: { code: string; message: string } | null
  meta: Record<string, unknown>
}

interface MempoolData {
  transaction_count: number
  orphan_transaction_count: number
  orphan_limit: number
  spent_outpoints_count: number
  orphaned_total: number
  orphan_promoted_total: number
  orphan_dropped_total: number
  orphan_pruned_total: number
  txids: string[]
}

interface TxListData {
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
  }>
}

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/rpc').replace(/\/$/, '')
const apiRoot = rawBaseUrl.endsWith('/api/v1') ? rawBaseUrl : `${rawBaseUrl}/api/v1`

async function request<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetch(`${apiRoot}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`PulseDAG RPC returned HTTP ${response.status}`)

    const envelope = (await response.json()) as ApiEnvelope<T>
    if (!envelope.ok || envelope.data === null) {
      throw new Error(envelope.error?.message || 'PulseDAG RPC returned an empty mempool response')
    }
    return envelope.data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('PulseDAG mempool request timed out')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function emptyMockPage(limit: number, offset: number): MempoolPage {
  return {
    count: 0,
    total: 0,
    limit,
    offset,
    hasMore: false,
    transactionCount: 0,
    orphanTransactionCount: 0,
    orphanLimit: 512,
    spentOutpointsCount: 0,
    orphanedTotal: 0,
    orphanPromotedTotal: 0,
    orphanDroppedTotal: 0,
    orphanPrunedTotal: 0,
    transactions: [],
  }
}

export const mempoolApi = {
  async getPage(limit: number, offset: number): Promise<MempoolPage> {
    if (!explorerApi.isLiveMode) return emptyMockPage(limit, offset)

    const [summary, page] = await Promise.all([
      request<MempoolData>('/mempool'),
      request<TxListData>(`/txs/page?limit=${limit}&offset=${offset}`),
    ])

    return {
      count: page.count,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.has_more,
      transactionCount: summary.transaction_count,
      orphanTransactionCount: summary.orphan_transaction_count,
      orphanLimit: summary.orphan_limit,
      spentOutpointsCount: summary.spent_outpoints_count,
      orphanedTotal: summary.orphaned_total,
      orphanPromotedTotal: summary.orphan_promoted_total,
      orphanDroppedTotal: summary.orphan_dropped_total,
      orphanPrunedTotal: summary.orphan_pruned_total,
      transactions: page.transactions,
    }
  },
}
