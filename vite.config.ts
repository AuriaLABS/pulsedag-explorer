import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rpcTarget = env.PULSEDAG_RPC_TARGET || 'http://127.0.0.1:8080'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 4173,
      proxy: {
        '/rpc': {
          target: rpcTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/rpc/, ''),
        },
      },
    },
  }
})
