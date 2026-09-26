const configuredBase = process.env.PULSEDAG_RPC_BASE_URL || 'http://127.0.0.1:8080/api/v1'
const baseUrl = configuredBase.replace(/\/$/, '')

function fail(message) {
  throw new Error(`Live RPC smoke failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5_000)
  })
  assert(response.ok, `${path} returned HTTP ${response.status}`)
  const envelope = await response.json()
  assert(envelope && typeof envelope === 'object', `${path} returned a non-object response`)
  assert(envelope.ok === true, `${path} returned ok=false: ${envelope.error?.code || 'unknown error'}`)
  assert(envelope.data && typeof envelope.data === 'object', `${path} returned no data object`)
  assert(envelope.error === null, `${path} returned an error alongside ok=true`)
  assert(envelope.meta && typeof envelope.meta === 'object', `${path} returned no meta object`)
  return envelope.data
}

const [status, release, policy, blocks, blockPage, sync, mempool, mempoolPage, transactionActivity, pow] = await Promise.all([
  request('/status'),
  request('/release'),
  request('/policy'),
  request('/blocks/recent?limit=20'),
  request('/blocks/page?limit=20&offset=0'),
  request('/sync/status'),
  request('/mempool'),
  request('/txs/page?limit=20&offset=0'),
  request('/txs/activity?limit=20&offset=0'),
  request('/pow/health')
])

const expectedReleaseMajor = (process.env.PULSEDAG_EXPECTED_RELEASE_MAJOR || '').replace(/^v/i, '')
const expectedNetworkProfile = process.env.PULSEDAG_EXPECTED_NETWORK_PROFILE || ''
const expectedChainId = process.env.PULSEDAG_EXPECTED_CHAIN_ID || ''
const expectedMonetaryPolicyFingerprint =
  (process.env.PULSEDAG_EXPECTED_MONETARY_POLICY_FINGERPRINT || '').toLowerCase()

assert(typeof status.chain_id === 'string' && status.chain_id.length > 0, 'status chain_id is missing')
assert(typeof release.network_profile === 'string' && release.network_profile.length > 0, 'release network_profile is missing')
assert(typeof release.chain_id === 'string' && release.chain_id.length > 0, 'release chain_id is missing')
assert(status.chain_id === release.chain_id, 'status and release chain IDs differ')
assert(status.version === release.version, 'status and release versions differ')
assert(Array.isArray(release.capabilities) && release.capabilities.includes('explorer_api'), 'release does not advertise explorer_api')
assert(status.contracts_enabled === false, 'status reports smart contracts enabled')
assert(release.capabilities.includes('contracts_disabled'), 'release does not advertise contracts_disabled')
assert(typeof release.smart_contracts === 'string' && release.smart_contracts.toLowerCase().startsWith('disabled'), 'release smart-contract state is not disabled')
if (expectedReleaseMajor) assert(release.version.replace(/^v/i, '').split('.')[0] === expectedReleaseMajor, `expected release major v${expectedReleaseMajor}, received ${release.version}`)
if (expectedNetworkProfile) assert(release.network_profile === expectedNetworkProfile, `expected network profile ${expectedNetworkProfile}, received ${release.network_profile}`)
if (expectedChainId) assert(release.chain_id === expectedChainId, `expected chain ID ${expectedChainId}, received ${release.chain_id}`)

if (release.version.replace(/^v/i, '').split('.')[0] === '3') {
  const monetary = policy.monetary_v3
  assert(monetary && typeof monetary === 'object', 'v3 policy omitted monetary_v3')
  assert(/^[0-9a-f]{64}$/i.test(monetary.policy_fingerprint), 'v3 monetary policy fingerprint is malformed')

  for (const [name, value] of [
    ['atoms_per_coin', monetary.atoms_per_coin],
    ['max_supply_atoms', monetary.max_supply_atoms],
    ['genesis_issuance_atoms', monetary.genesis_issuance_atoms],
    ['year1_target_issuance_atoms', monetary.year1_target_issuance_atoms],
    ['decay_factor_q64', monetary.decay_factor_q64],
    ['half_life_end_factor_q64', monetary.half_life_end_factor_q64],
    ['tail_emission_atoms', monetary.tail_emission_atoms]
  ]) {
    assert(/^\d+$/.test(value), `v3 monetary field ${name} is not an integer string`)
  }

  assert(
    monetary.programmable_resource_fees_active === false,
    'v3 programmable resource fees are unexpectedly active'
  )
  if (monetary.production_cadence_frozen) {
    assert(
      /^[0-9a-f]{64}$/i.test(monetary.production_cadence_fingerprint || ''),
      'frozen v3 monetary cadence fingerprint is malformed'
    )
  }
  if (expectedMonetaryPolicyFingerprint) {
    assert(
      /^[0-9a-f]{64}$/.test(expectedMonetaryPolicyFingerprint),
      'configured monetary-policy fingerprint pin is malformed'
    )
    assert(
      monetary.policy_fingerprint.toLowerCase() === expectedMonetaryPolicyFingerprint,
      `expected monetary policy ${expectedMonetaryPolicyFingerprint}, received ${monetary.policy_fingerprint}`
    )
  }
  if (expectedReleaseMajor && expectedNetworkProfile && expectedChainId && expectedMonetaryPolicyFingerprint) {
    assert(
      monetary.production_cadence_frozen === true,
      'pinned v3 production deployment requires frozen monetary cadence'
    )
  }
}

const terminalBlockOffset = Math.ceil(blockPage.total / blockPage.limit) * blockPage.limit
const terminalTransactionOffset = Math.ceil(transactionActivity.total / transactionActivity.limit) * transactionActivity.limit
const [terminalBlockPage, terminalTransactionActivity] = await Promise.all([
  request(`/blocks/page?limit=${blockPage.limit}&offset=${terminalBlockOffset}`),
  request(`/txs/activity?limit=${transactionActivity.limit}&offset=${terminalTransactionOffset}`)
])
assert(status.rpc_response_degraded === false, 'status RPC response is degraded')
assert(status.rpc_response_stale === false, 'status RPC response is stale')
assert(Array.isArray(blocks.blocks) && blocks.blocks.length > 0, 'recent blocks returned no blocks')
assert(Array.isArray(blockPage.blocks) && blockPage.blocks.length > 0, 'first paginated block page returned no blocks')
assert(blockPage.limit === 20 && blockPage.offset === 0, 'first paginated block page coordinates are invalid')
assert(blockPage.count === blockPage.blocks.length, 'paginated block count does not match block array length')
assert(Array.isArray(terminalBlockPage.blocks) && terminalBlockPage.blocks.length === 0, 'terminal block page must be empty')
assert(terminalBlockPage.offset === terminalBlockOffset && terminalBlockPage.has_more === false, 'terminal block page boundary is invalid')
assert(typeof sync.consistency_ok === 'boolean', 'sync consistency flag is missing')
assert(typeof sync.lag_blocks === 'number', 'sync lag_blocks is missing')
assert(typeof mempool.transaction_count === 'number', 'mempool transaction_count is missing')
assert(Array.isArray(mempool.txids), 'mempool txids are missing')
assert(Array.isArray(mempoolPage.transactions), 'mempool page transactions are missing')
assert(mempoolPage.limit === 20 && mempoolPage.offset === 0, 'mempool page coordinates are invalid')
assert(mempoolPage.count === mempoolPage.transactions.length, 'mempool page count does not match transaction array length')
assert(mempoolPage.total === mempool.transaction_count, 'mempool page total does not match mempool summary')
assert(Array.isArray(transactionActivity.transactions) && transactionActivity.transactions.length > 0, 'transaction activity returned no entries')
assert(transactionActivity.limit === 20 && transactionActivity.offset === 0, 'transaction activity page coordinates are invalid')
assert(transactionActivity.count === transactionActivity.transactions.length, 'transaction activity count does not match transaction array length')
assert(transactionActivity.total >= transactionActivity.count, 'transaction activity total does not cover page count')
assert(Array.isArray(terminalTransactionActivity.transactions) && terminalTransactionActivity.transactions.length === 0, 'terminal transaction activity page must be empty')
assert(terminalTransactionActivity.offset === terminalTransactionOffset && terminalTransactionActivity.has_more === false, 'terminal transaction activity boundary is invalid')
assert(terminalTransactionActivity.total === transactionActivity.total, 'transaction activity total changed across page boundaries')
assert(typeof pow.status === 'string', 'PoW health status is missing')

const head = blocks.blocks[0]
assert(status.selected_tip === head.hash, 'status selected_tip does not match the first recent block')
assert(status.best_height === head.height, 'status best_height does not match the first recent block height')
assert(blockPage.blocks[0].hash === head.hash, 'first paginated block does not match the recent head block')

const [overview, blockSearch, missingSearch] = await Promise.all([
  request(`/blocks/${encodeURIComponent(head.hash)}/overview`),
  request(`/search/${encodeURIComponent(head.hash)}`),
  request('/search/not-found')
])

assert(overview.hash === head.hash, 'block overview hash does not match the recent block')
assert(overview.height === head.height, 'block overview height does not match the recent block')
assert(Array.isArray(overview.parent_hashes), 'block overview parent_hashes is missing')
assert(Array.isArray(overview.txids) && overview.txids.length > 0, 'block overview returned no transactions')
assert(blockSearch.found === true && blockSearch.kind === 'block', 'exact block search did not resolve the head block')
assert(blockSearch.hash === head.hash, 'exact block search returned a different hash')
assert(missingSearch.found === false && missingSearch.kind === 'unknown', 'missing search did not return the stable not-found shape')

const txid = overview.txids[0]
const [transaction, transactionSearch] = await Promise.all([
  request(`/txs/${encodeURIComponent(txid)}/lookup`),
  request(`/search/${encodeURIComponent(txid)}`)
])

assert(transaction.txid === txid, 'transaction lookup returned a different txid')
assert(transaction.block_hash === head.hash, 'transaction lookup returned a different block hash')
assert(transaction.block_height === head.height, 'transaction lookup returned a different block height')
assert(Array.isArray(transaction.inputs), 'transaction inputs are missing')
assert(Array.isArray(transaction.outputs) && transaction.outputs.length > 0, 'transaction outputs are missing')
assert(transactionSearch.found === true && transactionSearch.kind === 'transaction', 'exact transaction search did not resolve the transaction')
assert(transactionSearch.hash === txid, 'exact transaction search returned a different txid')
const activityItem = transactionActivity.transactions.find((item) => item.txid === txid)
assert(activityItem, 'transaction activity does not contain the linked transaction')
assert(activityItem.is_confirmed === true && activityItem.is_mempool === false, 'linked transaction activity context is invalid')
assert(activityItem.block_hash === head.hash && activityItem.block_height === head.height, 'transaction activity links to a different block')

const output = transaction.outputs[0]
assert(typeof output.address === 'string' && output.address.length > 0, 'transaction output address is missing')
assert(typeof output.amount === 'number', 'transaction output amount is missing')

const encodedAddress = encodeURIComponent(output.address)
const [addressSummary, addressActivity, addressSearch] = await Promise.all([
  request(`/address/${encodedAddress}/summary`),
  request(`/address/${encodedAddress}/activity?limit=20&offset=0`),
  request(`/search/${encodedAddress}`)
])
const terminalAddressOffset = Math.ceil(addressActivity.total / addressActivity.limit) * addressActivity.limit
const terminalAddressActivity = await request(
  `/address/${encodedAddress}/activity?limit=${addressActivity.limit}&offset=${terminalAddressOffset}`
)

assert(addressSummary.address === output.address, 'address summary returned a different address')
assert(typeof addressSummary.confirmed_balance === 'number', 'address confirmed balance is missing')
assert(Array.isArray(addressSummary.mempool_txids), 'address mempool txids are missing')
assert(addressActivity.address === output.address, 'address activity returned a different address')
assert(Array.isArray(addressActivity.activity) && addressActivity.activity.length > 0, 'address activity returned no entries')
assert(addressActivity.activity.some((item) => item.txid === txid), 'address activity does not contain the linked transaction')
assert(terminalAddressActivity.address === output.address, 'terminal address activity returned a different address')
assert(Array.isArray(terminalAddressActivity.activity) && terminalAddressActivity.activity.length === 0, 'terminal address activity page must be empty')
assert(terminalAddressActivity.offset === terminalAddressOffset && terminalAddressActivity.has_more === false, 'terminal address activity boundary is invalid')
assert(addressSearch.found === true && addressSearch.kind === 'address', 'exact address search did not resolve the address')
assert(addressSearch.address === output.address, 'exact address search returned a different address')

console.log(JSON.stringify({
  base_url: baseUrl,
  version: release.version,
  network_profile: release.network_profile,
  chain_id: release.chain_id,
  identity_pinned: Boolean(expectedReleaseMajor && expectedNetworkProfile && expectedChainId),
  monetary_policy_fingerprint: policy.monetary_v3?.policy_fingerprint ?? null,
  monetary_policy_pinned: Boolean(expectedMonetaryPolicyFingerprint),
  production_cadence_frozen: policy.monetary_v3?.production_cadence_frozen ?? false,
  best_height: status.best_height,
  head_hash: head.hash,
  block_page_total: blockPage.total,
  transaction_id: txid,
  transaction_activity_total: transactionActivity.total,
  output_address: output.address,
  confirmed_balance: addressSummary.confirmed_balance,
  address_activity_total: addressActivity.total,
  peer_count: status.peer_count,
  sync_state: sync.sync_state,
  lag_blocks: sync.lag_blocks,
  mempool_transactions: mempool.transaction_count,
  mempool_page_total: mempoolPage.total,
  pow_status: pow.status,
  pow_alerts: pow.alerts,
  result: 'pass'
}, null, 2))
