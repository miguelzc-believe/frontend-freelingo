/** Deterministic HTTP fixture for browser tests; never contacts external providers. */
import { createServer } from 'node:http'

const user = {
  id: 1,
  username: 'learner',
  display_name: 'Test Learner',
  email: 'learner@example.invalid',
  role: 'user',
  native_language: 'es',
  target_language: 'en-GB',
  ui_locale: 'en',
  learning_goals: [],
  is_verified: true,
  conversation_max_duration: 1800,
  conversation_inactivity_timeout: 180,
  conversation_speech_pause: 1000,
}
const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname
  const json = (value: unknown, status = 200) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(value))
  }
  if (path === '/api/config')
    return json({
      allow_registration: true,
      stripe_enabled: false,
      maintenance_mode: false,
    })
  if (path === '/api/reviews/public') return json([])
  if (path === '/api/auth/login') {
    response.setHeader(
      'set-cookie',
      'refresh_token=browser-fixture; HttpOnly; Path=/; SameSite=Lax'
    )
    return json({ access_token: 'fixture-access', user })
  }
  if (path === '/api/auth/refresh') {
    if (!request.headers.cookie?.includes('refresh_token='))
      return json({ detail: 'Unauthorized' }, 401)
    return json({ access_token: 'fixture-access' })
  }
  if (path === '/api/auth/logout') {
    response.setHeader(
      'set-cookie',
      'refresh_token=; HttpOnly; Path=/; Max-Age=0'
    )
    return json({ ok: true })
  }
  if (path === '/api/auth/me') return json(user)
  if (path === '/api/languages')
    return json({
      active_language: 'en-GB',
      languages: [
        {
          target_language: 'en-GB',
          is_active: true,
          plan: null,
          progress: null,
        },
      ],
      all_supported_languages: ['en-GB', 'es'],
    })
  if (path === '/api/progress/summary')
    return json({ current_streak: 2, total_xp: 50, skills: {} })
  if (path === '/api/study-plan/today')
    return json({
      lessons: [],
      cefr_level: 'A1',
      plan_id: 1,
      progress_day: 1,
      total_days: 48,
    })
  if (path === '/api/feedback/unread-count') return json({ count: 0 })
  if (path === '/api/feedback/unread-summary') return json({ unread_count: 0 })
  if (path === '/api/chat') {
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
    })
    response.write('data: {"token":"first"}\n\n')
    setTimeout(() => response.end('data: {"done":true}\n\n'), 100)
    return
  }
  if (path === '/api/tts') {
    response.writeHead(200, { 'content-type': 'audio/mpeg' })
    response.end(Buffer.from([0, 255, 10]))
    return
  }
  return json({ detail: 'Not found in test fixture' }, 404)
})
server.listen(3199, '127.0.0.1')
