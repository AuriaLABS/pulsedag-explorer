export type DashboardView = 'overview' | 'blocks' | 'mempool' | 'node'

export interface PaginationRouteState {
  limit: number
  offset: number
}

export const DEFAULT_PAGE_LIMIT = 20
export const MAX_PAGE_LIMIT = 100

export type ExplorerRoute =
  | { kind: 'dashboard'; view: 'overview' | 'node' }
  | { kind: 'dashboard'; view: 'blocks' | 'mempool'; pagination: PaginationRouteState }
  | { kind: 'block'; id: string }
  | { kind: 'transaction'; id: string }
  | { kind: 'address'; id: string; pagination: PaginationRouteState }
  | { kind: 'not-found'; path: string }

function decodeSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim()
    return decoded.length > 0 ? decoded : null
  } catch {
    return null
  }
}

function boundedInteger(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export function parsePagination(search: string): PaginationRouteState {
  const params = new URLSearchParams(search)
  return {
    limit: boundedInteger(params.get('limit'), DEFAULT_PAGE_LIMIT, 1, MAX_PAGE_LIMIT),
    offset: boundedInteger(params.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER),
  }
}

function paginationSuffix(pagination: PaginationRouteState): string {
  const params = new URLSearchParams()
  if (pagination.limit !== DEFAULT_PAGE_LIMIT) params.set('limit', String(pagination.limit))
  if (pagination.offset > 0) params.set('offset', String(pagination.offset))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function parseExplorerRoute(pathname: string, search = ''): ExplorerRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/'

  if (normalized === '/') return { kind: 'dashboard', view: 'overview' }
  if (normalized === '/blocks') return { kind: 'dashboard', view: 'blocks', pagination: parsePagination(search) }
  if (normalized === '/mempool') return { kind: 'dashboard', view: 'mempool', pagination: parsePagination(search) }
  if (normalized === '/node') return { kind: 'dashboard', view: 'node' }

  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 2) {
    const id = decodeSegment(segments[1])
    if (id) {
      if (segments[0] === 'block') return { kind: 'block', id }
      if (segments[0] === 'tx') return { kind: 'transaction', id }
      if (segments[0] === 'address') return { kind: 'address', id, pagination: parsePagination(search) }
    }
  }

  return { kind: 'not-found', path: normalized }
}

export function explorerRoutePath(route: ExplorerRoute): string {
  switch (route.kind) {
    case 'dashboard':
      if (route.view === 'blocks') return `/blocks${paginationSuffix(route.pagination)}`
      if (route.view === 'mempool') return `/mempool${paginationSuffix(route.pagination)}`
      if (route.view === 'node') return '/node'
      return '/'
    case 'block':
      return `/block/${encodeURIComponent(route.id)}`
    case 'transaction':
      return `/tx/${encodeURIComponent(route.id)}`
    case 'address':
      return `/address/${encodeURIComponent(route.id)}${paginationSuffix(route.pagination)}`
    case 'not-found':
      return route.path
  }
}

export function explorerRouteTitle(route: ExplorerRoute): string {
  switch (route.kind) {
    case 'dashboard':
      if (route.view === 'blocks') {
        const page = Math.floor(route.pagination.offset / route.pagination.limit) + 1
        return `DAG blocks · Page ${page} · PulseDAG Explorer`
      }
      if (route.view === 'mempool') {
        const page = Math.floor(route.pagination.offset / route.pagination.limit) + 1
        return `Mempool · Page ${page} · PulseDAG Explorer`
      }
      if (route.view === 'node') return 'Node health · PulseDAG Explorer'
      return 'Overview · PulseDAG Explorer'
    case 'block':
      return `Block ${route.id.slice(0, 12)} · PulseDAG Explorer`
    case 'transaction':
      return `Transaction ${route.id.slice(0, 12)} · PulseDAG Explorer`
    case 'address': {
      const page = Math.floor(route.pagination.offset / route.pagination.limit) + 1
      return `Address ${route.id.slice(0, 18)} · Page ${page} · PulseDAG Explorer`
    }
    case 'not-found':
      return 'Not found · PulseDAG Explorer'
  }
}

export function explorerRouteHeading(route: ExplorerRoute): string {
  switch (route.kind) {
    case 'dashboard':
      if (route.view === 'blocks') return 'DAG blocks'
      if (route.view === 'mempool') return 'Mempool'
      if (route.view === 'node') return 'Node health'
      return 'Overview'
    case 'block':
      return 'Block details'
    case 'transaction':
      return 'Transaction details'
    case 'address':
      return 'Address details'
    case 'not-found':
      return 'Page not found'
  }
}
