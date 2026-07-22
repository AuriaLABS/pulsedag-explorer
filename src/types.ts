export type EventStatus = 'accepted' | 'pending' | 'rejected'

export interface NetworkStats {
  dagHeight: number
  eventsPerSecond: number
  activeNodes: number
  medianFinalityMs: number
  transactions24h: number
  networkLoad: number
}

export interface DagEvent {
  id: string
  shortId: string
  timestamp: string
  age: string
  transactions: number
  sizeBytes: number
  status: EventStatus
  parents: string[]
  issuer: string
}

export interface NodeInfo {
  id: string
  label: string
  region: string
  version: string
  latencyMs: number
  status: 'online' | 'syncing'
}

export interface SearchResult {
  kind: 'event' | 'transaction' | 'address'
  id: string
  title: string
  subtitle: string
}
