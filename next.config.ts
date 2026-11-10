// Fails the build on a missing or malformed variable.
import './src/env'
import { UPLOAD_BODY_LIMIT } from './src/lib/space-file-limits'

import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// The public media origin can be R2 or the local S3 service.
const r2 = new URL(process.env.R2_PUBLIC_URL!)
const localStorage =
  process.env.NODE_ENV === 'development' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(r2.hostname)

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (Dockerfile, Dokploy).
  output: 'standalone',
  // The first pages of a build wait for Payload to start in each worker and
  // for a free database connection, and passed the 60-second default; Next
  // then rendered them again. Later pages take well under a second.
  staticPageGenerationTimeout: 180,
  // The Docker build on Dokploy only runs after CI passed `pnpm typecheck` and
  // `pnpm build` for the same commit, so it skips the repeated check.
  typescript: {
    ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === 'true',
  },
  // The profile form sends a photo of up to 5 MB; a space post or comment up
  // to 36 MB of files (src/lib/space-file-limits.ts). The default limit is 1 MB.
  experimental: {
    cpus: process.env.CI ? 2 : undefined,
    serverActions: { bodySizeLimit: UPLOAD_BODY_LIMIT },
    proxyClientMaxBodySize: UPLOAD_BODY_LIMIT,
  },
  images: {
    dangerouslyAllowLocalIP: localStorage,
    remotePatterns: [
      {
        protocol: r2.protocol.replace(':', '') as 'http' | 'https',
        hostname: r2.hostname,
        port: r2.port,
        pathname: `${r2.pathname.replace(/\/$/, '')}/**`,
      },
    ],
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
      {
        pathname: '/assets/images/**',
      },
    ],
  },
  // PostHog's event addresses end in a slash (/e/); Next would redirect them
  // and the redirect breaks sendBeacon. src/proxy.ts puts the redirect back
  // for the site's own pages.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        // The service worker must never be served stale, or a fix to it waits
        // out the browser's cache. It may control the whole site.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
