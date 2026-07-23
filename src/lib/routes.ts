export type DashboardView = 'overview' | 'blocks' | 'node'

export type ExplorerRoute =
  | { kind: 'dashboard'; view: DashboardView }
  | { kind: 'block'; id: string }
  | { kind: 'transaction'; id: string }
  | { kind: 'address'; id: string }
  | { kind: 'not-found'; path: string }

function decodeSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim()
    return decoded.length > 0 ? decoded : null
  } catch {
    return null
  }
}

export function parseExplorerRoute(pathname: string): ExplorerRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/'

  if (normalized === '/') return { kind: 'dashboard', view: 'overview' }
  if (normalized === '/blocks') return { kind: 'dashboard', view: 'blocks' }
  if (normalized === '/node') return { kind: 'dashboard', view: 'node' }

  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 2) {
    const id = decodeSegment(segments[1])
    if (id) {
      if (segments[0] === 'block') return { kind: 'block', id }
      if (segments[0] === 'tx') return { kind: 'transaction', id }
      if (segments[0] === 'address') return { kind: 'address', id }
    }
  }

  return { kind: 'not-found', path: normalized }
}

export function explorerRoutePath(route: ExplorerRoute): string {
  switch (route.kind) {
    case 'dashboard':
      if (route.view === 'blocks') return '/blocks'
      if (route.view === 'node') return '/node'
      return '/'
    case 'block':
      return `/block/${encodeURIComponent(route.id)}`
    case 'transaction':
      return `/tx/${encodeURIComponent(route.id)}`
    case 'address':
      return `/address/${encodeURIComponent(route.id)}`
    case 'not-found':
      return route.path
  }
}

export function explorerRouteTitle(route: ExplorerRoute): string {
  switch (route.kind) {
    case 'dashboard':
      if (route.view === 'blocks') return 'DAG blocks · PulseDAG Explorer'
      if (route.view === 'node') return 'Node health · PulseDAG Explorer'
      return 'Overview · PulseDAG Explorer'
    case 'block':
      return `Block ${route.id.slice(0, 12)} · PulseDAG Explorer`
    case 'transaction':
      return `Transaction ${route.id.slice(0, 12)} · PulseDAG Explorer`
    case 'address':
      return `Address ${route.id.slice(0, 18)} · PulseDAG Explorer`
    case 'not-found':
      return 'Not found · PulseDAG Explorer'
  }
}

export function explorerRouteHeading(route: ExplorerRoute): string {
  switch (route.kind) {
    case 'dashboard':
      if (route.view === 'blocks') return 'DAG blocks'
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
