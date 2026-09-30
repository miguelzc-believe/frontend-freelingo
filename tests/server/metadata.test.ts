import { expect, it } from 'vitest'
import {
  manifestResponse,
  robotsResponse,
  sitemapResponse,
} from '@/server/metadata'

it('serves install metadata and the original public sitemap/robot boundaries', async () => {
  const manifest = manifestResponse()
  expect(manifest.headers.get('content-type')).toBe('application/manifest+json')
  expect(await manifest.json()).toMatchObject({
    start_url: '/',
    display: 'standalone',
    theme_color: '#0c1316',
  })
  const robots = await robotsResponse().text()
  expect(robots).toContain('Disallow: /admin')
  expect(robots).toContain('Allow: /register')
  const sitemap = await sitemapResponse().text()
  expect(sitemap.match(/<url>/g)).toHaveLength(5)
  expect(sitemap).not.toContain('/dashboard')
})
