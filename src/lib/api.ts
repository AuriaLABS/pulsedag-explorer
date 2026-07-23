import { createMockSnapshot, findMockBlock, searchMockData } from '../data/mock'
import type { DagEvent, ExplorerSnapshot, NetworkStats, NodeInfo, SearchResult } from '../types'

interface ApiEnvelope<T> {
  ok: boolean
  data: T | null
  error: { code: string; message: string } | null
  meta: Record<string, unknown>
}

interface NodeStatusData {
  rpc_response_degraded: boolean
  rpc_response_stale: boolean
  rpc_response_degraded_reason: string | null
  network_id: string
  service: string
  version: string
  chain_id: string
  best_height: number
  block_count: number
  selected_tip: string | null
  selected_height: number | null
  consensus_mode: string
  tip_count: number
  orphan_count: number
  mempool_size: number
  snapshot_height: number | null
  persisted_block_count: number
  p2p_mode: string | null
  peer_count: number
  sync_state: string
  storage_backend: string
}

interface SyncStatusData {
  rpc_response_degraded: boolean
  rpc_response_stale: boolean
  consistency_ok: boolean
  consistency_issue_count: number
  lag_blocks: number
  sync_state: string
  network_selected_height_gap: number
  storage_replay_gap: number
  live_sync_error_active: number
  p2p_ready_for_private_rehearsal: boolean
  readiness_reasons: string[]
}

interface MempoolData {
  transaction_count: number
  orphan_transaction_count: number
  orphan_limit: number
  spent_outpoints_count: number
  txids: string[]
}

interface PowHealthData {
  status: string
  snapshot_count: number
  latest_suggested_difficulty: number
  latest_avg_block_interval_secs: number
  alerts: string[]
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
  blocks: BlockListItem[]
}

interface BlockOverviewData {
  hash: string
  height: number
  blue_score: number
  timestamp: number
  parent_hashes: string[]
  tx_count: number
}

interface SearchResultData {
  query: string
  kind: string
  found: boolean
  hash: string | null
  address: string | null
  block_height: number | null
  status: string | null
}

const configuredMode = import.meta.env.VITE_DATA_MODE?.trim().toLowerCase()
const isLiveMode = configuredMode === 'live' || (!configuredMode && Boolean(import.meta.env.VITE_API_BASE_URL))
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/rpc').replace(/\/$/, '')
const apiRoot = rawBaseUrl.endsWith('/api/v1') ? rawBaseUrl : `${rawBaseUrl}/api/v1`
const configuredPollInterval = Number(import.meta.env.VITE_POLL_INTERVAL_MS || 15_000)
const pollIntervalMs = Number.isFinite(configuredPollInterval)
  ? Math.min(60_000, Math.max(5_000, configuredPollInterval))
  : 15_000

class PulseDagApiError extends Error {
  constructor(
    message: string,
    readonly code = 'REQUEST_FAILED',
  ) {
    super(message)
  }
}

async function request<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetch(`${apiRoot}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new PulseDagApiError(`PulseDAG RPC returned HTTP ${response.status}`, `HTTP_${response.status}`)
    }

    const envelope = (await response.json()) as ApiEnvelope<T>
    if (!envelope.ok || envelope.data === null) {
      throw new PulseDagApiError(
        envelope.error?.message || 'PulseDAG RPC returned an empty response',
        envelope.error?.code || 'EMPTY_RESPONSE',
      )
    }
    return envelope.data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new PulseDagApiError('PulseDAG RPC request timed out', 'TIMEOUT')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

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

function deriveOperationalPressure(
  lagBlocks: number,
  mempoolTransactions: number,
  orphanTransactions: number,
): number {
  const lagPressure = Math.min(100, (lagBlocks / 64) * 100)
  const mempoolPressure = Math.min(100, (mempoolTransactions / 4_096) * 100)
  const orphanPressure = Math.min(100, (orphanTransactions / 512) * 100)
  return Math.round(Math.max(lagPressure, mempoolPressure, orphanPressure))
}

function nodeState(status: NodeStatusData, sync: SyncStatusData | null): NodeInfo['status'] {
  if (status.rpc_response_degraded || status.rpc_response_stale || sync?.rpc_response_degraded) {
    return 'degraded'
  }
  if (status.sync_state !== 'synced' || (sync?.lag_blocks ?? 0) > 0) return 'syncing'
  return 'online'
}

function rejectionMessage(result: PromiseRejectedResult): string {
  return result.reason instanceof Error ? result.reason.message : String(result.reason)
}

async function getLiveSnapshot(): Promise<ExplorerSnapshot> {
  const startedAt = performance.now()
  const [statusResult, blocksResult, syncResult, mempoolResult, powResult] = await Promise.allSettled([
    request<NodeStatusData>('/status'),
    request<BlocksData>('/blocks/recent?limit=20'),
    request<SyncStatusData>('/sync/status'),
    request<MempoolData>('/mempool'),
    request<PowHealthData>('/pow/health'),
  ])

  if (statusResult.status === 'rejected') throw statusResult.reason
  if (blocksResult.status === 'rejected') throw blocksResult.reason

  const status = statusResult.value
  const blocks = blocksResult.value
  const sync = syncResult.status === 'fulfilled' ? syncResult.value : null
  const mempool = mempoolResult.status === 'fulfilled' ? mempoolResult.value : null
  const pow = powResult.status === 'fulfilled' ? powResult.value : null
  const warnings: string[] = []

  if (syncResult.status === 'rejected') warnings.push(`Sync status unavailable: ${rejectionMessage(syncResult)}`)
  if (mempoolResult.status === 'rejected') warnings.push(`Mempool status unavailable: ${rejectionMessage(mempoolResult)}`)
  if (powResult.status === 'rejected') warnings.push(`PoW health unavailable: ${rejectionMessage(powResult)}`)
  if (status.rpc_response_degraded_reason) warnings.push(status.rpc_response_degraded_reason)
  if (sync && !sync.consistency_ok) warnings.push(`Sync consistency reports ${sync.consistency_issue_count} issue(s)`)
  if (pow?.alerts.length) warnings.push(...pow.alerts)

  const lagBlocks = sync?.lag_blocks ?? 0
  const mempoolTransactions = mempool?.transaction_count ?? status.mempool_size
  const orphanTransactions = mempool?.orphan_transaction_count ?? 0
  const latencyMs = Math.max(1, Math.round(performance.now() - startedAt))

  const stats: NetworkStats = {
    dagHeight: status.best_height,
    blockCount: status.block_count,
    tipCount: status.tip_count,
    peerCount: status.peer_count,
    mempoolTransactions,
    orphanTransactions,
    syncState: sync?.sync_state ?? status.sync_state,
    lagBlocks,
    blockIntervalSeconds: pow?.latest_avg_block_interval_secs ?? 0,
    difficulty: pow?.latest_suggested_difficulty ?? 0,
    operationalPressure: deriveOperationalPressure(lagBlocks, mempoolTransactions, orphanTransactions),
    version: status.version,
    chainId: status.chain_id || status.network_id,
    consensusMode: status.consensus_mode,
    snapshotHeight: status.snapshot_height,
    rpcDegraded: status.rpc_response_degraded || status.rpc_response_stale,
    powStatus: pow?.status ?? 'unknown',
  }

  const node: NodeInfo = {
    id: status.service || 'pulsedagd',
    label: 'Connected PulseDAG node',
    chainId: stats.chainId,
    version: status.version,
    latencyMs,
    status: nodeState(status, sync),
    peerCount: status.peer_count,
    bestHeight: status.best_height,
    syncState: stats.syncState,
    p2pMode: status.p2p_mode ?? 'unknown',
    storageBackend: status.storage_backend,
  }

  return {
    stats,
    events: blocks.blocks.map(mapBlock),
    nodes: [node],
    mode: 'live',
    fetchedAt: new Date().toISOString(),
    warnings: [...new Set(warnings)],
  }
}

export const explorerApi = {
  isLiveMode,
  pollIntervalMs,

  async getSnapshot(): Promise<ExplorerSnapshot> {
    return isLiveMode ? getLiveSnapshot() : createMockSnapshot()
  },

  async getBlockOverview(hash: string): Promise<DagEvent | null> {
    if (!isLiveMode) return findMockBlock(hash)
    const block = await request<BlockOverviewData>(`/blocks/${encodeURIComponent(hash)}/overview`)
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
    }
  },

  async search(query: string): Promise<SearchResult[]> {
    const normalized = query.trim()
    if (!normalized) return []
    if (!isLiveMode) return searchMockData(normalized)

    const result = await request<SearchResultData>(`/search/${encodeURIComponent(normalized)}`)
    if (!result.found || !['block', 'transaction', 'address'].includes(result.kind)) return []

    const id = result.hash || result.address || result.query
    const kind = result.kind as SearchResult['kind']
    const subtitleParts = [result.status]
    if (result.block_height !== null) subtitleParts.push(`height ${result.block_height}`)

    return [{
      kind,
      id,
      title: kind === 'block' ? shortHash(id) : id,
      subtitle: subtitleParts.filter(Boolean).join(' · '),
      blockHeight: result.block_height,
      status: result.status,
    }]
  },
}
