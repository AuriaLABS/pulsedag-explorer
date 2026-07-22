import type { DagEvent, NetworkStats, NodeInfo } from '../types'

export const networkStats: NetworkStats = {
  dagHeight: 1_284_392,
  eventsPerSecond: 46.8,
  activeNodes: 128,
  medianFinalityMs: 740,
  transactions24h: 824_193,
  networkLoad: 63,
}

export const events: DagEvent[] = [
  {
    id: 'e7c2d0a9f42b817843e6940b7f36c3c17be1f98d742f6b515dc7e2c7bde98a11',
    shortId: 'e7c2d0…98a11',
    timestamp: '2026-07-22T18:42:18.220Z',
    age: '2 sec',
    transactions: 42,
    sizeBytes: 18_420,
    status: 'accepted',
    parents: ['63fa12…81be0', 'aa02f4…19c61'],
    issuer: 'node-eu-west-03',
  },
  {
    id: '6a3d2e88961cc9d8eb43c15e7421ab2e5b92150c8e924a3c4a67b471720cc20f',
    shortId: '6a3d2e…0cc20',
    timestamp: '2026-07-22T18:42:17.830Z',
    age: '3 sec',
    transactions: 17,
    sizeBytes: 9_284,
    status: 'accepted',
    parents: ['e7c2d0…98a11', '481c20…cc120'],
    issuer: 'node-us-east-02',
  },
  {
    id: '19df13c18dfbdf1f0a92eb13381d34dd64fe25aa0acb55a23e0482fac005d0b1',
    shortId: '19df13…05d0b',
    timestamp: '2026-07-22T18:42:17.040Z',
    age: '4 sec',
    transactions: 31,
    sizeBytes: 14_952,
    status: 'pending',
    parents: ['6a3d2e…0cc20', '63fa12…81be0'],
    issuer: 'node-ap-south-01',
  },
  {
    id: '63fa12aeeb58f0c849b77d9294edfa5f9f09f966b8f35352b94584fbc3981be0',
    shortId: '63fa12…81be0',
    timestamp: '2026-07-22T18:42:15.610Z',
    age: '6 sec',
    transactions: 26,
    sizeBytes: 12_194,
    status: 'accepted',
    parents: ['aa02f4…19c61', 'b51d14…80f21'],
    issuer: 'node-eu-central-01',
  },
  {
    id: 'aa02f4a691d6714ab2f45672dd1133e5102e748c61d6fa0fe9793ac915219c61',
    shortId: 'aa02f4…19c61',
    timestamp: '2026-07-22T18:42:13.920Z',
    age: '8 sec',
    transactions: 8,
    sizeBytes: 5_133,
    status: 'accepted',
    parents: ['b51d14…80f21', '8cdf17…3f410'],
    issuer: 'node-eu-west-01',
  },
]

export const nodes: NodeInfo[] = [
  { id: 'node-eu-west-03', label: 'EU West 03', region: 'Madrid', version: 'v2.1.0-rc.3', latencyMs: 18, status: 'online' },
  { id: 'node-eu-central-01', label: 'EU Central 01', region: 'Frankfurt', version: 'v2.1.0-rc.3', latencyMs: 31, status: 'online' },
  { id: 'node-us-east-02', label: 'US East 02', region: 'Virginia', version: 'v2.1.0-rc.2', latencyMs: 88, status: 'online' },
  { id: 'node-ap-south-01', label: 'AP South 01', region: 'Mumbai', version: 'v2.1.0-rc.3', latencyMs: 142, status: 'syncing' },
]
