export type EventStatus = 'accepted' | 'pending' | 'rejected'
export type ConnectionMode = 'live' | 'mock'
export type NodeStatus = 'online' | 'syncing' | 'degraded' | 'offline'

export interface NetworkStats {
  dagHeight: number
  blockCount: number
  tipCount: number
  peerCount: number
  mempoolTransactions: number
  orphanTransactions: number
  syncState: string
  lagBlocks: number
  blockIntervalSeconds: number
  difficulty: number
  operationalPressure: number
  version: string
  chainId: string
  consensusMode: string
  snapshotHeight: number | null
  rpcDegraded: boolean
  powStatus: string
}

export interface DagEvent {
  id: string
  shortId: string
  timestamp: string
  age: string
  transactions: number
  status: EventStatus
  parents: string[]
  parentCount: number
  height: number
  blueScore: number
}

export interface NodeInfo {
  id: string
  label: string
  chainId: string
  version: string
  latencyMs: number
  status: NodeStatus
  peerCount: number
  bestHeight: number
  syncState: string
  p2pMode: string
  storageBackend: string
}

export interface SearchResult {
  kind: 'block' | 'transaction' | 'address'
  id: string
  title: string
  subtitle: string
  blockHeight: number | null
  status: string | null
}

export interface TransactionOutpoint {
  txid: string
  index: number
}

export interface TransactionOutput {
  address: string
  amount: number
}

export interface TransactionDetail {
  txid: string
  status: string
  isMempool: boolean
  isConfirmed: boolean
  fee: number
  nonce: number
  blockHash: string | null
  blockHeight: number | null
  confirmations: number | null
  inputs: TransactionOutpoint[]
  outputs: TransactionOutput[]
}

export interface AddressActivityItem {
  txid: string
  direction: string
  incoming: number
  outgoing: number
  net: number
  context: string
  isMempool: boolean
  isConfirmed: boolean
  blockHash: string | null
  blockHeight: number | null
}

export interface AddressDetail {
  address: string
  confirmedBalance: number
  confirmedUtxoCount: number
  pendingIncoming: number
  pendingOutgoing: number
  pendingNet: number
  mempoolTxCount: number
  mempoolTxids: string[]
  mempoolExplicit: boolean
  activity: AddressActivityItem[]
  activityTotal: number
  activityHasMore: boolean
}

export interface ExplorerSnapshot {
  stats: NetworkStats
  events: DagEvent[]
  nodes: NodeInfo[]
  mode: ConnectionMode
  fetchedAt: string
  warnings: string[]
}
