import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { securityHeaders, contentSecurityPolicy } from './src/server/security'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Only the server receives private environment values. Public config is allowlisted in the root loader.
  Object.assign(process.env, env)
  return {
    build: { assetsInlineLimit: 0 },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    plugins: [
      tailwind(),
      tanstackStart(),
      nitro({
        preset: 'node-server',
        routeRules: {
          '/**': {
            headers: {
              ...securityHeaders,
              ...(mode === 'production'
                ? { 'Content-Security-Policy': contentSecurityPolicy }
                : {}),
            },
          },
        },
      }),
      react(),
    ],
    server: {
      headers: securityHeaders,
    },
  }
})
