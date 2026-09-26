/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'live' | 'mock'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_POLL_INTERVAL_MS?: string
  readonly VITE_RPC_TIMEOUT_MS?: string
  readonly VITE_RPC_MAX_RETRIES?: string
  readonly VITE_RPC_RETRY_BASE_MS?: string
  readonly VITE_EXPECTED_RELEASE_MAJOR?: string
  readonly VITE_EXPECTED_NETWORK_PROFILE?: string
  readonly VITE_EXPECTED_CHAIN_ID?: string
  readonly VITE_REQUIRE_CONTRACTS_DISABLED?: string
  readonly VITE_EXPECTED_MONETARY_POLICY_FINGERPRINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
