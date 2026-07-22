import { events, networkStats, nodes } from '../data/mock'
import type { DagEvent, NetworkStats, NodeInfo, SearchResult } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

async function request<T>(path: string): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('API base URL is not configured')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`PulseDAG API request failed (${response.status})`)
  }

  return response.json() as Promise<T>
}

export const explorerApi = {
  async getNetworkStats(): Promise<NetworkStats> {
    return API_BASE_URL ? request<NetworkStats>('/v1/network/stats') : networkStats
  },

  async getRecentEvents(): Promise<DagEvent[]> {
    return API_BASE_URL ? request<DagEvent[]>('/v1/events?limit=20') : events
  },

  async getNodes(): Promise<NodeInfo[]> {
    return API_BASE_URL ? request<NodeInfo[]>('/v1/nodes') : nodes
  },

  async search(query: string): Promise<SearchResult[]> {
    if (API_BASE_URL) {
      return request<SearchResult[]>(`/v1/search?q=${encodeURIComponent(query)}`)
    }

    const normalized = query.trim().toLowerCase()
    if (!normalized) return []

    return events
      .filter((event) => event.id.includes(normalized) || event.issuer.toLowerCase().includes(normalized))
      .map((event) => ({
        kind: 'event' as const,
        id: event.id,
        title: event.shortId,
        subtitle: `${event.transactions} transactions · ${event.issuer}`,
      }))
  },
}
