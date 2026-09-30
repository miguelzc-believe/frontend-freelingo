export function manifestResponse(): Response {
  return Response.json(
    {
      name: 'FreeLingo',
      short_name: 'FreeLingo',
      description: 'AI-powered language learning platform',
      start_url: '/',
      display: 'standalone',
      background_color: '#0c1316',
      theme_color: '#0c1316',
      icons: [
        { src: '/favicon.png', sizes: '32x32', type: 'image/png' },
        { src: '/logo.png', sizes: '72x72', type: 'image/png' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json' } }
  )
}
const disallowed = [
  '/dashboard',
  '/settings',
  '/chat',
  '/conversation',
  '/flashcards',
  '/plan',
  '/progress',
  '/grammar',
  '/vocabulary',
  '/phrasebook',
  '/assessment',
  '/admin',
  '/onboarding',
  '/faq',
  '/api/',
]
export function robotsResponse(): Response {
  return new Response(
    [
      'User-agent: *',
      ...['/', '/login', '/register', '/privacy', '/terms'].map(
        (path) => `Allow: ${path}`
      ),
      ...disallowed.map((path) => `Disallow: ${path}`),
      '',
      'Sitemap: https://freelingo.app/sitemap.xml',
      '',
    ].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8' } }
  )
}
export function sitemapResponse(): Response {
  const entries = ['', '/login', '/register', '/privacy', '/terms'].map(
    (path) =>
      `<url><loc>https://freelingo.app${path}</loc><lastmod>${new Date().toISOString()}</lastmod><changefreq>${path ? 'yearly' : 'monthly'}</changefreq><priority>${path ? (['/login', '/register'].includes(path) ? 0.5 : 0.3) : 1}</priority></url>`
  )
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } }
  )
}
