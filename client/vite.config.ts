import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

function escapeHtmlAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function searchConsoleMetaPlugin() {
  let verificationToken = '';
  return {
    name: 'nido-search-console-meta',
    configResolved(config: { env?: Record<string, string> }) {
      verificationToken =
        config.env?.VITE_GOOGLE_SITE_VERIFICATION?.trim() ||
        process.env.VITE_GOOGLE_SITE_VERIFICATION?.trim() ||
        '';
    },
    transformIndexHtml(html: string) {
      if (!verificationToken) {
        return html;
      }
      return [
        {
          tag: 'meta',
          attrs: {
            name: 'google-site-verification',
            content: escapeHtmlAttr(verificationToken),
          },
          injectTo: 'head' as const,
        },
      ];
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), searchConsoleMetaPlugin()],
  test: {
    clearMocks: true,
    environment: 'jsdom',
  },
});
