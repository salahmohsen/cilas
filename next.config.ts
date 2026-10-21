// Fails the build on a missing or malformed variable.
import './src/env'

import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// Uploads live on R2; next/image may resize them from there.
const r2 = new URL(process.env.R2_PUBLIC_URL!)

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (Dockerfile, Dokploy).
  output: 'standalone',
  // The first pages of a build wait for Payload to start in each worker and
  // for a free database connection, and passed the 60-second default; Next
  // then rendered them again. Later pages take well under a second.
  staticPageGenerationTimeout: 180,
  // The profile form sends a photo of up to 5 MB; the default limit is 1 MB.
  experimental: {
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    remotePatterns: [
      {
        protocol: r2.protocol.replace(':', '') as 'http' | 'https',
        hostname: r2.hostname,
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
