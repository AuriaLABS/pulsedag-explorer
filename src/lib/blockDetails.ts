import { explorerApi } from './api'
import type { DagEvent } from '../types'

interface ApiEnvelope<T> {
  ok: boolean
  data: T | null
  error: { code: string; message: string } | null
  meta: Record<string, unknown>
}

interface BlockOverviewData {
  hash: string
  height: number
  blue_score: number
  timestamp: number
  parent_hashes: string[]
  child_hashes: string[]
  tx_count: number
  txids: string[]
  confirmations: number
  is_tip: boolean
}

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/rpc').replace(/\/$/, '')
const apiRoot = rawBaseUrl.endsWith('/api/v1') ? rawBaseUrl : `${rawBaseUrl}/api/v1`

function shortHash(hash: string): string {
  if (hash.length <= 16) return hash
  return `${hash.slice(0, 7)}…${hash.slice(-5)}`
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

async function requestBlock(hash: string): Promise<BlockOverviewData> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetch(`${apiRoot}/blocks/${encodeURIComponent(hash)}/overview`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`PulseDAG RPC returned HTTP ${response.status}`)

    const envelope = (await response.json()) as ApiEnvelope<BlockOverviewData>
    if (!envelope.ok || envelope.data === null) {
      throw new Error(envelope.error?.message || 'PulseDAG RPC returned an empty block overview')
    }
    return envelope.data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('PulseDAG block overview request timed out')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export const blockDetailsApi = {
  async getBlock(hash: string): Promise<DagEvent | null> {
    if (!explorerApi.isLiveMode) return explorerApi.getBlockOverview(hash)

    const block = await requestBlock(hash)
    const timestamp = timestampToIso(block.timestamp)
    return {
      id: block.hash,
      shortId: shortHash(block.hash),
      timestamp,
      age: formatAge(timestamp),
      transactions: block.tx_count,
      status: 'accepted',
      parents: block.parent_hashes,
      parentCount: block.parent_hashes.length,
      height: block.height,
      blueScore: block.blue_score,
      txids: block.txids,
      childHashes: block.child_hashes,
      confirmations: block.confirmations,
      isTip: block.is_tip,
    }
  },
}
