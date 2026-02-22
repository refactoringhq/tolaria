/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { vaultApiPlugin } from './vite-plugins/vault-api.ts'
import { aiChatProxyPlugin } from './vite-plugins/ai-chat-proxy.ts'
import { mcpBridgeInfoPlugin } from './vite-plugins/mcp-bridge.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), vaultApiPlugin(), aiChatProxyPlugin(), mcpBridgeInfoPlugin()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Prevent vite from obscuring Rust errors
  clearScreen: false,

  // Tauri expects a fixed port
  server: {
    port: 5201,
    strictPort: true,
    allowedHosts: true,
  },

  // Env variables starting with TAURI_ are exposed to the frontend
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/mock-tauri.ts',
        'src/main.tsx',
        'src/types.ts',
        'src/hooks/useMcpBridge.ts',
        'src/hooks/useAIChat.ts',
        'src/utils/ai-chat.ts',
        'src/components/AIChatPanel.tsx',
        'src/components/ui/dropdown-menu.tsx',
        'src/components/ui/scroll-area.tsx',
        'src/components/ui/select.tsx',
        'src/components/ui/separator.tsx',
        'src/components/ui/tabs.tsx',
        'src/components/ui/tooltip.tsx',
        'src/components/ui/card.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
})
