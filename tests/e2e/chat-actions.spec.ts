import { expect, test, type Locator, type Page } from '@playwright/test'

const conversations = [101, 102, 103].map((id) => ({
  id,
  title: `Chat ${id}: Practising detailed travel conversations with long descriptive notes about listening, speaking and accessible keyboard navigation`,
  source: 'chat',
  created_at: '2026-07-04T10:00:00Z',
  updated_at: '2026-07-05T10:00:00Z',
}))
const messageFor = (id: number) => `Fixture message for conversation ${id}`

async function mockChat(page: Page, origin: string) {
  const items = conversations.map((item) => ({ ...item }))
  const calls: string[] = []
  const unexpected: string[] = []
  // apiFetch uses same-origin /api/chat transport. Include the voice
  // conversation namespace so accidental navigation cannot forward writes.
  await page.route(
    (url) =>
      url.origin === origin &&
      /^\/api\/(chat|conversations?)(\/|$)/.test(url.pathname),
    async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      const method = request.method()
      const call = `${method} ${path}`
      calls.push(call)
      if (method === 'GET' && path === '/api/chat/conversations')
        return route.fulfill({ json: items })
      const match = /^\/api\/chat\/conversations\/(\d+)(\/messages)?$/.exec(
        path
      )
      const item = items.find(
        (candidate) => candidate.id === Number(match?.[1])
      )
      if (match && item) {
        if (method === 'GET' && match[2])
          return route.fulfill({
            json: {
              messages: [
                { role: 'user', content: messageFor(item.id) },
                { role: 'assistant', content: `Fixture reply for ${item.id}` },
              ],
            },
          })
        if (method === 'DELETE' && !match[2]) {
          items.splice(items.indexOf(item), 1)
          return route.fulfill({ status: 204 })
        }
      }
      unexpected.push(call)
      await route.abort('blockedbyclient')
    }
  )
  return { calls, unexpected }
}

// Traverse real tab order: no element.focus() or synthesized key events.
async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 80; step++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement))
      return
  }
  await expect(target).toBeFocused()
}

async function assertFocus(control: Locator) {
  await expect(control).toBeFocused()
  const outline = await control.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      visible: element.matches(':focus-visible'),
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      color: style.outlineColor,
    }
  })
  expect(outline.visible).toBe(true)
  expect(outline.style).not.toBe('none')
  expect(outline.width).toBeGreaterThanOrEqual(2)
  expect(outline.color).not.toBe('rgba(0, 0, 0, 0)')
  // Focus reveals the delete control through a CSS opacity transition.
  // Retry within Playwright's existing expect timeout; still require full opacity.
  await expect
    .poll(() =>
      control.evaluate((element) => getComputedStyle(element).opacity)
    )
    .toBe('1')
}

async function assertRowLayout(primary: Locator) {
  await primary.scrollIntoViewIfNeeded()
  const geometry = await primary.evaluate((element) => {
    const row = element.parentElement!
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      sidebarOverflow:
        row.closest('aside')!.scrollWidth - row.closest('aside')!.clientWidth,
      truncated: element.scrollWidth > element.clientWidth,
      ellipsis: style.textOverflow,
      overflowX: style.overflowX,
      primaryRight: rect.right,
      controls: [...row.querySelectorAll('button')].map((button) => {
        const box = button.getBoundingClientRect()
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        }
      }),
      viewport: { width: innerWidth, height: innerHeight },
    }
  })
  expect(geometry.overflow).toBeLessThanOrEqual(1)
  expect(geometry.sidebarOverflow).toBeLessThanOrEqual(1)
  expect(geometry.truncated).toBe(true)
  expect(geometry.ellipsis).toBe('ellipsis')
  expect(geometry.overflowX).toBe('hidden')
  expect(geometry.controls).toHaveLength(2)
  expect(geometry.controls[0]!.width).toBeGreaterThanOrEqual(80)
  expect(geometry.controls[1]!.left).toBeGreaterThanOrEqual(
    geometry.primaryRight - 1
  )
  for (const box of geometry.controls) {
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(geometry.viewport.width + 1)
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(box.bottom).toBeLessThanOrEqual(geometry.viewport.height + 1)
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fl_tour_done', '1')
    localStorage.setItem('fl_whats_new_seen_v1.9.25', '1')
    localStorage.setItem('fl_cookie_consent', 'accepted')
    localStorage.setItem(
      'fl-theme',
      JSON.stringify({ state: { theme: 'light' }, version: 0 })
    )
  })
})

test('chat keyboard selection and sibling deletion preserve responsive sidebar behavior', async ({
  page,
  baseURL,
}, info) => {
  const fixture = await mockChat(page, new URL(baseURL!).origin)
  const mobile = info.project.name === 'mobile'
  await page.goto('/login')
  await page
    .locator('[autocomplete="username"]')
    .fill('learner@example.invalid')
  await page.locator('[autocomplete="current-password"]').fill('fixture-only')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('body')).toContainText('Test Learner')
  await page.goto('/chat')
  await expect(page.getByText(messageFor(101), { exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const sidebar = page
    .locator('aside')
    .filter({ hasText: conversations[0]!.title })
  const primaryFor = (id: number) =>
    sidebar.getByRole('button', {
      name: conversations.find((item) => item.id === id)!.title,
      exact: true,
    })
  const openSidebar = async () => {
    if (mobile) {
      const toggle = page.getByTitle('Show chats', { exact: true })
      await expect(toggle).toHaveJSProperty('tagName', 'BUTTON')
      await toggle.click()
    }
    await expect(sidebar).toBeVisible()
  }
  const messageCalls = () =>
    fixture.calls.filter((call) => call.endsWith('/messages'))
  const assertActive = async (id: number) => {
    await expect(primaryFor(id).locator('..')).toHaveClass(/bg-fl-surface-2/)
    for (const item of conversations.filter((item) => item.id !== id)) {
      await expect(primaryFor(item.id).locator('..')).not.toHaveClass(
        /bg-fl-surface-2/
      )
    }
  }

  // T7: desktop Escape from the input keeps the sidebar; mobile Escape
  // dismisses an open sidebar, including when focus remains in the input.
  const input = page.getByPlaceholder('Type a message...', { exact: true })
  await input.click()
  await page.keyboard.press('Escape')
  if (mobile) await expect(sidebar).toHaveCount(0)
  else await expect(sidebar).toBeVisible()
  await openSidebar()
  await tabTo(page, input)
  await page.keyboard.press('Escape')
  if (mobile) {
    await expect(sidebar).toHaveCount(0)
    await openSidebar()
  } else await expect(sidebar).toBeVisible()
  await assertActive(101)

  for (const [id, key] of [
    [102, 'Enter'],
    [103, 'Space'],
  ] as const) {
    const primary = primaryFor(id)
    await expect(primary).toHaveAttribute('type', 'button')
    await expect(primary.locator('button, a, input')).toHaveCount(0)
    const siblingDelete = primary
      .locator('..')
      .getByRole('button', { name: 'Delete', exact: true })
    await expect(siblingDelete).toHaveAttribute('type', 'button')
    await assertRowLayout(primary)
    await tabTo(page, primary)
    await assertFocus(primary)
    await page.keyboard.press('Tab')
    await assertFocus(siblingDelete)
    await page.keyboard.press('Shift+Tab')
    await assertFocus(primary)
    await page.screenshot({ path: info.outputPath(`chat-${id}-focused.png`) })
    const before = messageCalls().length
    await page.keyboard.press(key)
    await expect(page.getByText(messageFor(id), { exact: true })).toBeVisible()
    await expect(
      page.getByText(messageFor(id === 102 ? 101 : 102), { exact: true })
    ).toHaveCount(0)
    expect(messageCalls().slice(before)).toEqual([
      `GET /api/chat/conversations/${id}/messages`,
    ])
    if (mobile) await expect(sidebar).toHaveCount(0)
    else await expect(sidebar).toBeVisible()
    await openSidebar()
    await assertActive(id)
  }

  // Delete the non-active 102: neither opening/cancelling nor confirming
  // should select it or refetch messages for the still-active 103.
  const primary = primaryFor(102)
  const deleteButton = primary
    .locator('..')
    .getByRole('button', { name: 'Delete', exact: true })
  const beforeDelete = [...messageCalls()]
  const dialog = page.getByRole('alertdialog', {
    name: 'Delete Chat',
    exact: true,
  })
  await tabTo(page, primary)
  await page.keyboard.press('Tab')
  await assertFocus(deleteButton)
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await assertActive(103)
  expect(messageCalls()).toEqual(beforeDelete)
  expect(fixture.calls.filter((call) => call.startsWith('DELETE '))).toEqual([])
  await page.screenshot({
    path: info.outputPath('chat-delete-confirmation.png'),
  })
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(primary).toBeVisible()
  expect(messageCalls()).toEqual(beforeDelete)
  expect(fixture.calls.filter((call) => call.startsWith('DELETE '))).toEqual([])
  await tabTo(page, deleteButton)
  await page.keyboard.press('Space')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(primary).toHaveCount(0)
  await expect(primaryFor(103).locator('..')).toHaveClass(/bg-fl-surface-2/)
  await expect(page.getByText(messageFor(103), { exact: true })).toBeVisible()
  await expect(sidebar).toBeVisible()
  expect(messageCalls()).toEqual(beforeDelete)
  expect(fixture.calls.filter((call) => call.startsWith('DELETE '))).toEqual([
    'DELETE /api/chat/conversations/102',
  ])
  expect(fixture.unexpected).toEqual([])
})
