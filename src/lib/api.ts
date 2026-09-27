import { createMockSnapshot, findMockBlock, searchMockData } from '../data/mock'
import type {
  AddressDetail,
  DagEvent,
  ExplorerSnapshot,
  NetworkStats,
  NodeInfo,
  SearchResult,
  TransactionDetail,
} from '../types'

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
  contracts_enabled: boolean
}

interface ReleaseInfoData {
  version: string
  network_profile: string
  chain_id: string
  capabilities: string[]
  api_profile: string
  smart_contracts: string
}

interface MonetaryPolicyV3Data {
  activation_state: string
  policy_version: string
  policy_fingerprint: string
  production_cadence_fingerprint: string | null
  production_cadence_frozen: boolean
  symbol: string
  decimals: number
  atoms_per_coin: string
  max_supply_atoms: string
  genesis_issuance_atoms: string
  year1_target_issuance_atoms: string
  economic_year_seconds: number
  half_life_years: number
  half_life_seconds: number
  emission_quantum_seconds: number
  decay_factor_q64: string
  half_life_end_factor_q64: string
  terminal_half_lives: number
  terminal_economic_year: number
  terminal_emission_quantum: number
  terminal_emission_seconds: number
  coinbase_maturity_seconds: number
  ordinary_fee_recipient_bps: number
  consensus_burn_bps: number
  tail_emission_atoms: string
  programmable_resource_fees_active: boolean
}

interface PolicyData {
  monetary_v3?: MonetaryPolicyV3Data | null
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

interface TransactionLookupData {
  txid: string
  status: string
  is_mempool: boolean
  is_confirmed: boolean
  fee: number
  nonce: number
  block_hash: string | null
  block_height: number | null
  confirmations: number | null
  inputs: Array<{ txid: string; index: number }>
  outputs: Array<{ address: string; amount: number }>
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
const configuredPollInterval = Number(import.meta.env.VITE_POLL_INTERVAL_MS || 15_000)
const pollIntervalMs = Number.isFinite(configuredPollInterval)
  ? Math.min(60_000, Math.max(5_000, configuredPollInterval))
  : 15_000

const configuredRpcTimeout = Number(import.meta.env.VITE_RPC_TIMEOUT_MS || 5_000)
const rpcTimeoutMs = Number.isFinite(configuredRpcTimeout)
  ? Math.min(15_000, Math.max(1_000, Math.round(configuredRpcTimeout)))
  : 5_000
const configuredRpcMaxRetries = Number(import.meta.env.VITE_RPC_MAX_RETRIES || 1)
const rpcMaxRetries = Number.isFinite(configuredRpcMaxRetries)
  ? Math.min(2, Math.max(0, Math.floor(configuredRpcMaxRetries)))
  : 1
const configuredRpcRetryBase = Number(import.meta.env.VITE_RPC_RETRY_BASE_MS || 300)
const rpcRetryBaseMs = Number.isFinite(configuredRpcRetryBase)
  ? Math.min(2_000, Math.max(100, Math.round(configuredRpcRetryBase)))
  : 300
const maxRetryDelayMs = 5_000
const transientHttpStatuses = new Set([408, 425, 429, 500, 502, 503, 504])

const expectedReleaseMajor = import.meta.env.VITE_EXPECTED_RELEASE_MAJOR?.trim().replace(/^v/i, '') || ''
const expectedNetworkProfile = import.meta.env.VITE_EXPECTED_NETWORK_PROFILE?.trim() || ''
const expectedChainId = import.meta.env.VITE_EXPECTED_CHAIN_ID?.trim() || ''
const expectedMonetaryPolicyFingerprint =
  import.meta.env.VITE_EXPECTED_MONETARY_POLICY_FINGERPRINT?.trim().toLowerCase() || ''
const requireContractsDisabled = (import.meta.env.VITE_REQUIRE_CONTRACTS_DISABLED?.trim().toLowerCase() || 'true') !== 'false'

class PulseDagApiError extends Error {
  constructor(
    message: string,
    readonly code = 'REQUEST_FAILED',
    readonly retryable = false,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message)
  }
}

function parseRetryAfterMs(response: Response): number | null {
  const value = response.headers.get('Retry-After')?.trim()
  if (!value) return null

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(maxRetryDelayMs, Math.round(seconds * 1_000))
  }

  const retryAt = Date.parse(value)
  if (!Number.isFinite(retryAt)) return null
  return Math.min(maxRetryDelayMs, Math.max(0, retryAt - Date.now()))
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs))
}

async function requestAttempt<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), rpcTimeoutMs)

  try {
    const response = await fetch(`${apiRoot}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) {
      const retryable = transientHttpStatuses.has(response.status)
      throw new PulseDagApiError(
        `PulseDAG RPC returned HTTP ${response.status}`,
        `HTTP_${response.status}`,
        retryable,
        retryable ? parseRetryAfterMs(response) : null,
      )
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
    if (error instanceof PulseDagApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new PulseDagApiError('PulseDAG RPC request timed out', 'TIMEOUT', true)
    }
    if (error instanceof TypeError) {
      throw new PulseDagApiError('PulseDAG RPC network request failed', 'NETWORK_ERROR', true)
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function request<T>(path: string): Promise<T> {
  let retryCount = 0

  while (true) {
    try {
      return await requestAttempt<T>(path)
    } catch (error) {
      const canRetry =
        error instanceof PulseDagApiError &&
        error.retryable &&
        retryCount < rpcMaxRetries
      if (!canRetry) throw error

      const exponentialDelay = rpcRetryBaseMs * (2 ** retryCount)
      const retryDelay = Math.min(
        maxRetryDelayMs,
        Math.max(exponentialDelay, error.retryAfterMs ?? 0),
      )
      retryCount += 1
      await sleep(retryDelay)
    }
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

function releaseMajor(version: string): string {
  return version.trim().replace(/^v/i, '').split('.')[0] || ''
}

function assertLiveIdentity(status: NodeStatusData, release: ReleaseInfoData): boolean {
  if (!status.version?.trim() || !status.chain_id?.trim()) {
    throw new PulseDagApiError('PulseDAG /status omitted required release or chain identity fields', 'STATUS_IDENTITY_MISSING')
  }
  if (!release.version?.trim() || !release.network_profile?.trim() || !release.chain_id?.trim()) {
    throw new PulseDagApiError('PulseDAG /release omitted required network identity fields', 'RELEASE_IDENTITY_MISSING')
  }
  if (!Array.isArray(release.capabilities)) {
    throw new PulseDagApiError('PulseDAG /release omitted the capabilities list', 'RELEASE_CAPABILITIES_MISSING')
  }

  if (status.chain_id !== release.chain_id) {
    throw new PulseDagApiError(
      `PulseDAG identity mismatch: /status reports chain ${status.chain_id} but /release reports ${release.chain_id}`,
      'NETWORK_IDENTITY_MISMATCH',
    )
  }

  if (status.version !== release.version) {
    throw new PulseDagApiError(
      `PulseDAG release mismatch: /status reports ${status.version} but /release reports ${release.version}`,
      'RELEASE_IDENTITY_MISMATCH',
    )
  }

  if (!release.capabilities.includes('explorer_api')) {
    throw new PulseDagApiError('Connected node does not advertise the explorer_api capability', 'EXPLORER_CAPABILITY_MISSING')
  }

  if (expectedReleaseMajor && releaseMajor(release.version) !== expectedReleaseMajor) {
    throw new PulseDagApiError(
      `Expected PulseDAG release major v${expectedReleaseMajor}, received ${release.version}`,
      'RELEASE_MAJOR_MISMATCH',
    )
  }

  if (expectedNetworkProfile && release.network_profile !== expectedNetworkProfile) {
    throw new PulseDagApiError(
      `Expected network profile ${expectedNetworkProfile}, received ${release.network_profile}`,
      'NETWORK_PROFILE_MISMATCH',
    )
  }

  if (expectedChainId && release.chain_id !== expectedChainId) {
    throw new PulseDagApiError(
      `Expected chain ID ${expectedChainId}, received ${release.chain_id}`,
      'CHAIN_ID_MISMATCH',
    )
  }

  if (requireContractsDisabled) {
    const releaseSaysDisabled =
      release.capabilities.includes('contracts_disabled') &&
      typeof release.smart_contracts === 'string' &&
      release.smart_contracts.toLowerCase().startsWith('disabled')
    if (status.contracts_enabled !== false || !releaseSaysDisabled) {
      throw new PulseDagApiError(
        'Smart-contract surfaces are not proven inactive; v3.0.0 explorer access is fail-closed',
        'CONTRACTS_NOT_DISABLED',
      )
    }
  }

  return Boolean(expectedReleaseMajor && expectedNetworkProfile && expectedChainId)
}

function assertV3MonetaryPolicy(
  release: ReleaseInfoData,
  policy: PolicyData | null,
): { monetary: MonetaryPolicyV3Data | null; pinned: boolean } {
  if (releaseMajor(release.version) !== '3') return { monetary: null, pinned: false }

  const monetary = policy?.monetary_v3
  if (!monetary) {
    throw new PulseDagApiError(
      'PulseDAG v3 /policy omitted the monetary_v3 contract',
      'MONETARY_POLICY_MISSING',
    )
  }

  if (
    typeof monetary.policy_version !== 'string' ||
    !monetary.policy_version.trim() ||
    typeof monetary.policy_fingerprint !== 'string' ||
    !/^[0-9a-f]{64}$/i.test(monetary.policy_fingerprint)
  ) {
    throw new PulseDagApiError(
      'PulseDAG v3 monetary policy identity is malformed',
      'MONETARY_POLICY_IDENTITY_INVALID',
    )
  }

  for (const [name, value] of [
    ['atoms_per_coin', monetary.atoms_per_coin],
    ['max_supply_atoms', monetary.max_supply_atoms],
    ['genesis_issuance_atoms', monetary.genesis_issuance_atoms],
    ['year1_target_issuance_atoms', monetary.year1_target_issuance_atoms],
    ['decay_factor_q64', monetary.decay_factor_q64],
    ['half_life_end_factor_q64', monetary.half_life_end_factor_q64],
    ['tail_emission_atoms', monetary.tail_emission_atoms],
  ] as const) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new PulseDagApiError(
        `PulseDAG v3 monetary field ${name} must remain an integer string`,
        'MONETARY_VALUE_ENCODING_INVALID',
      )
    }
  }

  if (
    monetary.programmable_resource_fees_active !== false ||
    typeof monetary.production_cadence_frozen !== 'boolean' ||
    typeof monetary.symbol !== 'string' ||
    !monetary.symbol.trim() ||
    !Number.isInteger(monetary.decimals) ||
    monetary.decimals < 0 ||
    monetary.decimals > 18 ||
    !Number.isSafeInteger(monetary.half_life_years) ||
    monetary.half_life_years <= 0 ||
    !Number.isSafeInteger(monetary.emission_quantum_seconds) ||
    monetary.emission_quantum_seconds <= 0 ||
    !Number.isSafeInteger(monetary.terminal_economic_year) ||
    monetary.terminal_economic_year <= 0
  ) {
    throw new PulseDagApiError(
      'PulseDAG v3 monetary policy is incompatible with the read-only launch boundary',
      'MONETARY_POLICY_INCOMPATIBLE',
    )
  }

  if (
    monetary.production_cadence_frozen &&
    (
      typeof monetary.production_cadence_fingerprint !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(monetary.production_cadence_fingerprint)
    )
  ) {
    throw new PulseDagApiError(
      'PulseDAG v3 reports a frozen production cadence without a valid cadence fingerprint',
      'MONETARY_CADENCE_IDENTITY_INVALID',
    )
  }

  const fingerprint = monetary.policy_fingerprint.toLowerCase()
  if (
    expectedMonetaryPolicyFingerprint &&
    !/^[0-9a-f]{64}$/.test(expectedMonetaryPolicyFingerprint)
  ) {
    throw new PulseDagApiError(
      'Configured monetary-policy fingerprint pin is malformed',
      'MONETARY_POLICY_PIN_INVALID',
    )
  }
  if (expectedMonetaryPolicyFingerprint && fingerprint !== expectedMonetaryPolicyFingerprint) {
    throw new PulseDagApiError(
      `Expected monetary policy ${expectedMonetaryPolicyFingerprint}, received ${fingerprint}`,
      'MONETARY_POLICY_FINGERPRINT_MISMATCH',
    )
  }

  const productionPinsComplete = Boolean(
    expectedReleaseMajor &&
    expectedNetworkProfile &&
    expectedChainId &&
    expectedMonetaryPolicyFingerprint,
  )
  if (productionPinsComplete && !monetary.production_cadence_frozen) {
    throw new PulseDagApiError(
      'Pinned v3 production deployment requires a frozen monetary cadence',
      'MONETARY_CADENCE_NOT_FROZEN',
    )
  }

  return { monetary, pinned: Boolean(expectedMonetaryPolicyFingerprint) }
}

async function getLiveSnapshot(): Promise<ExplorerSnapshot> {
  const startedAt = performance.now()
  const [statusResult, releaseResult, policyResult, blocksResult, syncResult, mempoolResult, powResult] = await Promise.allSettled([
    request<NodeStatusData>('/status'),
    request<ReleaseInfoData>('/release'),
    request<PolicyData>('/policy'),
    request<BlocksData>('/blocks/recent?limit=20'),
    request<SyncStatusData>('/sync/status'),
    request<MempoolData>('/mempool'),
    request<PowHealthData>('/pow/health'),
  ])

  if (statusResult.status === 'rejected') throw statusResult.reason
  if (releaseResult.status === 'rejected') throw releaseResult.reason
  if (blocksResult.status === 'rejected') throw blocksResult.reason

  const status = statusResult.value
  const release = releaseResult.value
  const blocks = blocksResult.value
  const identityPinned = assertLiveIdentity(status, release)
  if (releaseMajor(release.version) === '3' && policyResult.status === 'rejected') {
    throw policyResult.reason
  }
  const policy = policyResult.status === 'fulfilled' ? policyResult.value : null
  const { monetary, pinned: monetaryPolicyPinned } = assertV3MonetaryPolicy(release, policy)
  const sync = syncResult.status === 'fulfilled' ? syncResult.value : null
  const mempool = mempoolResult.status === 'fulfilled' ? mempoolResult.value : null
  const pow = powResult.status === 'fulfilled' ? powResult.value : null
  const warnings: string[] = []

  if (!identityPinned) {
    warnings.push('Network identity is verified against /status and /release but is not pinned to a frozen deployment identity')
  }
  if (releaseMajor(release.version) === '3' && !monetaryPolicyPinned) {
    warnings.push('Monetary policy is verified from /policy but is not pinned to a frozen deployment fingerprint')
  }
  if (monetary && !monetary.production_cadence_frozen) {
    warnings.push('Production monetary cadence is not frozen yet')
  }
  if (policyResult.status === 'rejected' && releaseMajor(release.version) !== '3') {
    warnings.push(`Policy metadata unavailable: ${rejectionMessage(policyResult)}`)
  }
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
    releaseVersion: release.version,
    networkProfile: release.network_profile,
    chainId: release.chain_id,
    consensusMode: status.consensus_mode,
    contractsEnabled: status.contracts_enabled,
    identityPinned,
    monetaryPolicyVersion: monetary?.policy_version ?? null,
    monetaryPolicyFingerprint: monetary?.policy_fingerprint ?? null,
    monetaryPolicyPinned,
    monetarySymbol: monetary?.symbol ?? null,
    monetaryDecimals: monetary?.decimals ?? null,
    maxSupplyAtoms: monetary?.max_supply_atoms ?? null,
    monetaryHalfLifeYears: monetary?.half_life_years ?? null,
    monetaryEmissionQuantumSeconds: monetary?.emission_quantum_seconds ?? null,
    monetaryTerminalEconomicYear: monetary?.terminal_economic_year ?? null,
    monetaryProductionCadenceFrozen: monetary?.production_cadence_frozen ?? false,
    snapshotHeight: status.snapshot_height,
    rpcDegraded: status.rpc_response_degraded || status.rpc_response_stale,
    powStatus: pow?.status ?? 'unknown',
  }

  const node: NodeInfo = {
    id: status.service || 'pulsedagd',
    label: 'Connected PulseDAG node',
    chainId: stats.chainId,
    version: release.version,
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

  async getTransaction(txid: string): Promise<TransactionDetail> {
    if (!isLiveMode) throw new PulseDagApiError('Transaction details require a live PulseDAG RPC connection')
    const transaction = await request<TransactionLookupData>(`/txs/${encodeURIComponent(txid)}/lookup`)
    return {
      txid: transaction.txid,
      status: transaction.status,
      isMempool: transaction.is_mempool,
      isConfirmed: transaction.is_confirmed,
      fee: transaction.fee,
      nonce: transaction.nonce,
      blockHash: transaction.block_hash,
      blockHeight: transaction.block_height,
      confirmations: transaction.confirmations,
      inputs: transaction.inputs,
      outputs: transaction.outputs,
    }
  },

  async getAddress(address: string): Promise<AddressDetail> {
    if (!isLiveMode) throw new PulseDagApiError('Address details require a live PulseDAG RPC connection')
    const encodedAddress = encodeURIComponent(address)
    const [summary, activity] = await Promise.all([
      request<AddressSummaryData>(`/address/${encodedAddress}/summary`),
      request<AddressActivityData>(`/address/${encodedAddress}/activity?limit=20&offset=0`),
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
      activityTotal: activity.total,
      activityHasMore: activity.has_more,
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
