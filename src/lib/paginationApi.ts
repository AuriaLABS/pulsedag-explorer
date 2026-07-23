import { createMockSnapshot } from '../data/mock'
import type { AddressDetail, BlockPage, DagEvent } from '../types'

interface ApiEnvelope<T> {
  ok: boolean
  data: T | null
  error: { code: string; message: string } | null
  meta: Record<string, unknown>
}

interface BlockListItem {
  hash: string
  height: number
  blue_score: number
  tx_count: number
  timestamp: number
  parent_count: number
}

interface BlocksData {
  count: number
  total: number
  limit: number
  offset: number
  has_more: boolean
  blocks: BlockListItem[]
}

interface AddressSummaryData {
  address: string
  confirmed_balance: number
  confirmed_utxo_count: number
  pending_incoming: number
  pending_outgoing: number
  pending_net: number
  mempool_tx_count: number
  mempool_txids: string[]
  mempool_explicit: boolean
}

interface AddressActivityData {
  address: string
  count: number
  total: number
  limit: number
  offset: number
  has_more: boolean
  activity: Array<{
    txid: string
    direction: string
    incoming: number
    outgoing: number
    net: number
    context: string
    is_mempool: boolean
    is_confirmed: boolean
    block_hash: string | null
    block_height: number | null
  }>
}

const configuredMode = import.meta.env.VITE_DATA_MODE?.trim().toLowerCase()
const isLiveMode = configuredMode === 'live' || (!configuredMode && Boolean(import.meta.env.VITE_API_BASE_URL))
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/rpc').replace(/\/$/, '')
const apiRoot = rawBaseUrl.endsWith('/api/v1') ? rawBaseUrl : `${rawBaseUrl}/api/v1`

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiRoot}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`PulseDAG RPC returned HTTP ${response.status}`)
  const envelope = (await response.json()) as ApiEnvelope<T>
  if (!envelope.ok || envelope.data === null) {
    throw new Error(envelope.error?.message || 'PulseDAG RPC returned an empty response')
  }
  return envelope.data
}

function shortHash(hash: string): string {
  return hash.length <= 16 ? hash : `${hash.slice(0, 7)}…${hash.slice(-5)}`
}

function timestampToIso(timestamp: number): string {
  const milliseconds = timestamp < 10_000_000_000 ? timestamp * 1_000 : timestamp
  return new Date(milliseconds).toISOString()
}

function formatAge(timestamp: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1_000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`
  return `${Math.floor(seconds / 86_400)}d`
}

function mapBlock(block: BlockListItem): DagEvent {
  const timestamp = timestampToIso(block.timestamp)
  return {
    id: block.hash,
    shortId: shortHash(block.hash),
    timestamp,
    age: formatAge(timestamp),
    transactions: block.tx_count,
    status: 'accepted',
    parents: [],
    parentCount: block.parent_count,
    height: block.height,
    blueScore: block.blue_score,
  }
}

function boundedPage(limit: number, offset: number): { limit: number; offset: number } {
  return {
    limit: Math.min(100, Math.max(1, Math.floor(limit))),
    offset: Math.max(0, Math.floor(offset)),
  }
}

export const paginationApi = {
  async getBlocks(limit: number, offset: number): Promise<BlockPage> {
    const page = boundedPage(limit, offset)
    if (!isLiveMode) {
      const blocks = createMockSnapshot().events
      const paged = blocks.slice(page.offset, page.offset + page.limit)
      return {
        blocks: paged,
        count: paged.length,
        total: blocks.length,
        limit: page.limit,
        offset: page.offset,
        hasMore: page.offset + paged.length < blocks.length,
      }
    }

    const response = await request<BlocksData>(`/blocks/page?limit=${page.limit}&offset=${page.offset}`)
    return {
      blocks: response.blocks.map(mapBlock),
      count: response.count,
      total: response.total,
      limit: response.limit,
      offset: response.offset,
      hasMore: response.has_more,
    }
  },

  async getAddress(address: string, limit: number, offset: number): Promise<AddressDetail> {
    if (!isLiveMode) throw new Error('Address details require a live PulseDAG RPC connection')
    const page = boundedPage(limit, offset)
    const encodedAddress = encodeURIComponent(address)
    const [summary, activity] = await Promise.all([
      request<AddressSummaryData>(`/address/${encodedAddress}/summary`),
      request<AddressActivityData>(`/address/${encodedAddress}/activity?limit=${page.limit}&offset=${page.offset}`),
    ])

    return {
      address: summary.address,
      confirmedBalance: summary.confirmed_balance,
      confirmedUtxoCount: summary.confirmed_utxo_count,
      pendingIncoming: summary.pending_incoming,
      pendingOutgoing: summary.pending_outgoing,
      pendingNet: summary.pending_net,
      mempoolTxCount: summary.mempool_tx_count,
      mempoolTxids: summary.mempool_txids,
      mempoolExplicit: summary.mempool_explicit,
      activity: activity.activity.map((item) => ({
        txid: item.txid,
        direction: item.direction,
        incoming: item.incoming,
        outgoing: item.outgoing,
        net: item.net,
        context: item.context,
        isMempool: item.is_mempool,
        isConfirmed: item.is_confirmed,
        blockHash: item.block_hash,
        blockHeight: item.block_height,
      })),
      activityCount: activity.count,
      activityTotal: activity.total,
      activityLimit: activity.limit,
      activityOffset: activity.offset,
      activityHasMore: activity.has_more,
    }
  },
}
