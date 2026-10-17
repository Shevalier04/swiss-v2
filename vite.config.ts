import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png', 'sw-push.js'],
        manifest: {
          id: '/',
          name: '掌上课表 · Swiss Editorial',
          short_name: '掌上课表',
          description: '高格调瑞士排版风大学课程表小程序，支持周次切换、作业倒计时联动、上课提醒、桌面小组件生成、PDF教务导入与多账号管理。',
          theme_color: '#1d1f24',
          background_color: '#1d1f24',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: '今日课表',
              short_name: '今日',
              description: '查看今日课程与教室安排',
              url: '/?tab=today',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
            },
            {
              name: '快速记作业',
              short_name: '记作业',
              description: '快速记录和查看课程作业',
              url: '/?tab=hw',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
            },
            {
              name: '番茄钟待办',
              short_name: '待办',
              description: '个人任务清单与专注番茄钟',
              url: '/?tab=tasks',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
            },
          ],
        },
        workbox: {
          importScripts: ['/sw-push.js'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname ?? process.cwd(), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
