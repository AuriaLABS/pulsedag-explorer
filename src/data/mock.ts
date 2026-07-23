import type { DagEvent, ExplorerSnapshot, SearchResult } from '../types'

const hashes = [
  'e7c2d0a9f42b817843e6940b7f36c3c17be1f98d742f6b515dc7e2c7bde98a11',
  '6a3d2e88961cc9d8eb43c15e7421ab2e5b92150c8e924a3c4a67b471720cc20f',
  '19df13c18dfbdf1f0a92eb13381d34dd64fe25aa0acb55a23e0482fac005d0b1',
  '63fa12aeeb58f0c849b77d9294edfa5f9f09f966b8f35352b94584fbc3981be0',
  'aa02f4a691d6714ab2f45672dd1133e5102e748c61d6fa0fe9793ac915219c61',
]

function shortHash(hash: string): string {
  return `${hash.slice(0, 7)}…${hash.slice(-5)}`
}

function createEvents(): DagEvent[] {
  const now = Date.now()
  return hashes.map((hash, index) => {
    const timestamp = new Date(now - (index + 1) * 12_000).toISOString()
    return {
      id: hash,
      shortId: shortHash(hash),
      timestamp,
      age: `${(index + 1) * 12}s`,
      transactions: [4, 2, 7, 1, 3][index],
      status: 'accepted',
      parents: index < hashes.length - 1 ? [hashes[index + 1]] : [],
      parentCount: index < hashes.length - 1 ? 1 : 0,
      height: 12_840 - index,
      blueScore: 19_420 - index,
    }
  })
}

export function createMockSnapshot(): ExplorerSnapshot {
  const events = createEvents()
  return {
    stats: {
      dagHeight: 12_840,
      blockCount: 12_841,
      tipCount: 2,
      peerCount: 4,
      mempoolTransactions: 3,
      orphanTransactions: 0,
      syncState: 'synced',
      lagBlocks: 0,
      blockIntervalSeconds: 61,
      difficulty: 42_000,
      operationalPressure: 8,
      version: 'v2.3.0',
      chainId: 'pulsedag-private-testnet',
      consensusMode: 'ghostdag_dev',
      snapshotHeight: 12_700,
      rpcDegraded: false,
      powStatus: 'ok',
    },
    events,
    nodes: [{
      id: 'pulsedagd',
      label: 'Mock PulseDAG node',
      chainId: 'pulsedag-private-testnet',
      version: 'v2.3.0',
      latencyMs: 18,
      status: 'online',
      peerCount: 4,
      bestHeight: 12_840,
      syncState: 'synced',
      p2pMode: 'libp2p-real',
      storageBackend: 'rocksdb',
    }],
    mode: 'mock',
    fetchedAt: new Date().toISOString(),
    warnings: [],
  }
}

export function findMockBlock(hash: string): DagEvent | null {
  return createEvents().find((event) => event.id === hash) ?? null
}

export function searchMockData(query: string): SearchResult[] {
  const normalized = query.toLowerCase()
  return createEvents()
    .filter((event) => event.id.toLowerCase().includes(normalized) || event.shortId.toLowerCase().includes(normalized))
    .map((event) => ({
      kind: 'block' as const,
      id: event.id,
      title: event.shortId,
      subtitle: `confirmed · height ${event.height}`,
      blockHeight: event.height,
      status: 'confirmed',
    }))
}
