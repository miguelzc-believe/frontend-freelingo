import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { IntlProvider } from 'use-intl'
import { ThemeProvider } from '@/components/ThemeProvider'
import { CookieBanner } from '@/components/CookieBanner'
import NotFound from '@/app/not-found'
import ErrorPage from '@/app/error'
import { getRuntime } from '@/server/runtime'
import { setPublicConfig } from '@/lib/public-config'
import styles from '@/app/globals.css?url'

const themeScript = `(function(){try{var t='system';var s=localStorage.getItem('fl-theme');if(s){var p=JSON.parse(s);t=p&&p.state&&p.state.theme?p.state.theme:t}var l=t==='light'||(t==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches);if(l){document.documentElement.setAttribute('data-theme','light')}else{document.documentElement.removeAttribute('data-theme')}}catch(e){}})();`
const localeScript = `(function(){if(document.cookie.indexOf('LOCALE_DETECTED=')!==-1)return;var m=document.cookie.match(/(^| )NEXT_LOCALE=([^;]+)/);var cl=m?m[2]:null;var bl=(navigator.language||'').split('-')[0].toLowerCase();var s=['es','fr','pt','de','it','pl','nl','ro','ru','tr','sv','da','fi','hr'];document.cookie='LOCALE_DETECTED=1;path=/;max-age=31536000;SameSite=Lax';if(cl==='en'||s.indexOf(cl)!==-1)return;if(bl!=='en'&&s.indexOf(bl)!==-1&&cl!==bl){document.cookie='NEXT_LOCALE='+bl+';path=/;max-age=31536000;SameSite=Lax';location.reload()}})();`
export const Route = createRootRoute({
  loader: () => getRuntime(),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'FreeLingo' },
      {
        name: 'description',
        content:
          'FreeLingo is a self-hosted AI-powered language learning platform with voice conversation, flashcards, grammar lessons, and a personal AI tutor.',
      },
      {
        name: 'keywords',
        content:
          'English learning, AI language tutor, self-hosted, voice conversation, flashcards, CEFR, language learning app, learn English online',
      },
      { name: 'author', content: 'Arturo Carretero Calvo' },
      { name: 'creator', content: 'Arturo Carretero Calvo' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:url', content: 'https://freelingo.app' },
      {
        property: 'og:description',
        content:
          'Learn languages with an AI tutor, voice conversations, flashcards, and structured lessons. Self-hosted and privacy-friendly.',
      },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      {
        property: 'og:image:alt',
        content: 'FreeLingo: AI-powered language learning',
      },
      {
        name: 'twitter:title',
        content: 'FreeLingo: AI-powered language learning',
      },
      {
        name: 'twitter:description',
        content:
          'Learn languages with an AI tutor, voice conversations, flashcards, and structured lessons.',
      },
      { name: 'twitter:image', content: 'https://freelingo.app/logo.png' },
      { property: 'og:site_name', content: 'FreeLingo' },
      {
        property: 'og:title',
        content: 'FreeLingo: AI-powered language learning',
      },
      {
        property: 'og:image',
        content: 'https://freelingo.app/og-image-v2.png',
      },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'theme-color', content: '#0c1316' },
    ],
    links: [
      { rel: 'stylesheet', href: styles },
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  shellComponent: Document,
  component: Outlet,
  notFoundComponent: NotFound,
  errorComponent: RootError,
})
function RootError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <ErrorPage
      error={error instanceof Error ? error : new Error(String(error))}
      reset={() => {
        reset()
        void router.invalidate()
      }}
    />
  )
}
function Document({ children }: { children: React.ReactNode }) {
  const runtime = Route.useLoaderData()
  if (!runtime)
    return (
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body>
          {children}
          <Scripts />
        </body>
      </html>
    )
  // Media configuration is browser-only; no user state is written on the server.
  if (typeof window !== 'undefined')
    setPublicConfig({
      publicApiUrl: runtime.publicApiUrl,
      umamiWebsiteId: runtime.umamiWebsiteId,
    })
  return (
    <html
      lang={runtime.locale}
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeScript }} />
        {runtime.umamiWebsiteId && (
          <script
            defer
            src="/umami/script.js"
            data-host-url="/umami"
            data-website-id={runtime.umamiWebsiteId}
          />
        )}
      </head>
      <body className="bg-background text-foreground min-h-full">
        <IntlProvider
          timeZone="UTC"
          locale={runtime.locale}
          messages={runtime.messages}
        >
          <ThemeProvider>{children}</ThemeProvider>
          <CookieBanner />
        </IntlProvider>
        <Scripts />
      </body>
    </html>
  )
}
