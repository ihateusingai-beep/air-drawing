import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Vite + React 19 + TypeScript + PWA config.
 *
 * PWA config (R14 緩解 + Phase 4b 提前 ship):
 *   - registerType: 'autoUpdate' — 自動更新 SW
 *   - workbox precache 所有 build 產物
 *   - runtime cache: MediaPipe wasm + 模型檔案 (Phase 3 mid mode 預備)
 *   - manifest: standalone, iPad 16.4+ 完整支援
 *   - start_url: '/', scope: '/'
 *
 * 對標 R14 / R21 / R27 緩解。
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // R27 緩解: file size budget 限制 (PWA 細 bundle, 唔該追求 mobile-class size)
      manifest: false, // 我哋手動 public/manifest.webmanifest(vite-plugin-pwa 嘅 default manifest 太 generic)
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        // R14: 預 cache MediaPipe wasm + model (Phase 3 mid mode 啟用)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB per file
        cleanupOutdatedCaches: true,
        // R27: 唔做 runtime cache 任何 fetch (0 上傳)
        runtimeCaching: [
          {
            // MediaPipe wasm modules
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // Phase 4b testing 開, dev 環境 SW 太煩
      },
    }),
  ],
})
