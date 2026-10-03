import { expect, test, type Locator, type Page } from '@playwright/test'

const learner = {
  id: 1,
  username: 'learner',
  display_name: 'Test Learner',
  role: 'user' as const,
}
const other = {
  id: 2,
  username: 'practice-coordinator',
  display_name: 'Community Practice Coordinator With A Long Display Name',
  role: 'user' as const,
}

function entry(id: number, type: 'feature' | 'bug', owned: boolean) {
  return {
    id,
    type,
    title: `${owned ? 'Owned' : 'Community'} ${type}: Improve focused listening practice with detailed progress notes and accessible keyboard controls across every learning session`,
    description:
      'Keep longer practice notes readable on a narrow screen while preserving independent voting, opening details and deletion controls. Additional context should clamp rather than widen the row.',
    status: 'in_progress',
    author: owned ? learner : other,
    vote_count: 3,
    voted_by_me: false,
    unread_by_me: true,
    comment_count: 1,
    created_at: '2026-07-04T10:00:00Z',
  }
}

async function mockFeedback(page: Page, origin: string) {
  const entries = [
    entry(10, 'feature', true),
    entry(11, 'feature', false),
    entry(20, 'bug', true),
    entry(21, 'bug', false),
  ]
  const calls: string[] = []
  const unexpected: string[] = []
  // Match only this application's feedback transport, including badge reads.
  // Unknown feedback requests are aborted, never forwarded to a backend.
  await page.route(
    (url) =>
      url.origin === origin &&
      (url.pathname === '/api/feedback' ||
        url.pathname.startsWith('/api/feedback/')),
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname
      const method = request.method()
      calls.push(`${method} ${path}`)
      const json = (value: unknown) => route.fulfill({ json: value })
      if (method === 'GET' && path === '/api/feedback/unread-count')
        return json({
          count: entries.filter((item) => item.unread_by_me).length,
        })
      if (method === 'GET' && path === '/api/feedback/unread-summary')
        return json({
          unread_count: entries.filter((item) => item.unread_by_me).length,
        })
      if (method === 'GET' && path === '/api/feedback') {
        const filtered = entries.filter(
          (item) =>
            item.type === url.searchParams.get('type') &&
            (!url.searchParams.get('status') ||
              item.status === url.searchParams.get('status'))
        )
        const skip = Number(url.searchParams.get('skip') ?? 0)
        const limit = Number(url.searchParams.get('limit') ?? 10)
        return json({
          items: filtered.slice(skip, skip + limit),
          total: filtered.length,
          skip,
          limit,
        })
      }
      const match = /^\/api\/feedback\/(\d+)(?:\/(read|comments|vote))?$/.exec(
        path
      )
      const item = entries.find(
        (candidate) => candidate.id === Number(match?.[1])
      )
      if (match && item) {
        const action = match[2]
        if (method === 'GET' && !action) return json(item)
        if (method === 'GET' && action === 'comments')
          return json({
            items: [
              {
                id: item.id * 100,
                entry_id: item.id,
                author: other,
                body: `Fixture discussion for entry ${item.id}`,
                created_at: '2026-07-05T10:00:00Z',
              },
            ],
            total: 1,
          })
        if (method === 'POST' && action === 'read') {
          item.unread_by_me = false
          return json({ ok: true })
        }
        if (method === 'POST' && action === 'vote' && item.type === 'feature') {
          item.voted_by_me = !item.voted_by_me
          item.vote_count += item.voted_by_me ? 1 : -1
          return json({ voted: item.voted_by_me, vote_count: item.vote_count })
        }
        if (method === 'DELETE' && !action && item.author.id === learner.id) {
          entries.splice(entries.indexOf(item), 1)
          return route.fulfill({ status: 204 })
        }
      }
      unexpected.push(`${method} ${path}`)
      await route.abort('blockedbyclient')
    }
  )
  return { calls, unexpected }
}

// No programmatic focus: traverse the actual shell/list tab order, bounded so
// an unreachable primary action fails rather than hanging the browser runner.
async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 80; step++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement))
      return
  }
  await expect(target).toBeFocused()
}

async function assertRowLayout(primary: Locator) {
  await primary.scrollIntoViewIfNeeded()
  const layout = await primary.evaluate((element) => {
    const row = element.parentElement!
    const rect = element.getBoundingClientRect()
    const title = element.querySelector('span > span')!
    const titleStyle = getComputedStyle(title)
    const titleRect = title.getBoundingClientRect()
    const description = element.children[1]!
    const descriptionRect = description.getBoundingClientRect()
    return {
      viewport: { width: innerWidth, height: innerHeight },
      overflow: document.documentElement.scrollWidth - innerWidth,
      primary: { x: rect.x, right: rect.right, width: rect.width },
      controls: [...row.querySelectorAll('button')].map((button) => {
        const box = button.getBoundingClientRect()
        return {
          primary: button === element,
          x: box.x,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        }
      }),
      textContained: [...element.querySelectorAll('span')].every((span) => {
        const box = span.getBoundingClientRect()
        return box.left >= rect.left - 1 && box.right <= rect.right + 1
      }),
      titleContained: titleRect.right <= rect.right + 1,
      titleOverflow: title.scrollWidth > title.clientWidth,
      titleEllipsis: titleStyle.textOverflow,
      titleOverflowX: titleStyle.overflowX,
      descriptionHeight: descriptionRect.height,
      descriptionLineHeight: Number.parseFloat(
        getComputedStyle(description).lineHeight
      ),
    }
  })
  expect(layout.overflow).toBeLessThanOrEqual(1)
  expect(layout.primary.width).toBeGreaterThanOrEqual(80)
  expect(layout.textContained).toBe(true)
  expect(layout.titleContained).toBe(true)
  if (layout.titleOverflow) {
    expect(layout.titleEllipsis).toBe('ellipsis')
    expect(layout.titleOverflowX).toBe('hidden')
  }
  expect(layout.descriptionHeight).toBeLessThanOrEqual(
    layout.descriptionLineHeight * 2 + 1
  )
  for (const control of layout.controls) {
    expect(control.width).toBeGreaterThan(0)
    expect(control.height).toBeGreaterThan(0)
    expect(control.x).toBeGreaterThanOrEqual(0)
    expect(control.right).toBeLessThanOrEqual(layout.viewport.width + 1)
    expect(control.top).toBeGreaterThanOrEqual(0)
    expect(control.bottom).toBeLessThanOrEqual(layout.viewport.height + 1)
    if (!control.primary)
      expect(
        control.right <= layout.primary.x + 1 ||
          control.x >= layout.primary.right - 1
      ).toBe(true)
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

for (const type of ['feature', 'bug'] as const) {
  test(`${type} rows keep native primary actions separate from sibling controls`, async ({
    page,
    baseURL,
  }, info) => {
    const fixture = await mockFeedback(page, new URL(baseURL!).origin)
    await page.goto('/login')
    await page
      .locator('[autocomplete="username"]')
      .fill('learner@example.invalid')
    await page.locator('[autocomplete="current-password"]').fill('fixture-only')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.locator('body')).toContainText('Test Learner')
    await page.goto('/feedback')
    if (type === 'bug')
      await page
        .getByRole('button', { name: 'Bug reports', exact: true })
        .click()
    await page.evaluate(() => document.fonts.ready)

    const owned = entry(type === 'feature' ? 10 : 20, type, true)
    const community = entry(owned.id + 1, type, false)
    const primaryFor = (title: string) =>
      page.getByRole('button', { name: title, exact: false })
    const detail = page.getByRole('heading', { level: 2 })
    const back = page.getByRole('button', { name: '← Back', exact: true })
    const detailCalls = () =>
      fixture.calls.filter((call) => /\/(read|comments)$/.test(call)).length

    for (const item of [owned, community]) {
      const primary = primaryFor(item.title)
      await expect(primary).toBeVisible()
      await expect(primary).toHaveAttribute('type', 'button')
      await expect(primary.locator('button, a, input')).toHaveCount(0)
      const row = primary.locator('..')
      await expect(
        row.getByRole('button', { name: 'Delete', exact: true })
      ).toHaveCount(item.author.id === learner.id ? 1 : 0)
      await expect(
        row.getByRole('button', { name: 'Vote', exact: true })
      ).toHaveCount(type === 'feature' ? 1 : 0)
      await assertRowLayout(primary)
      await tabTo(page, primary)
      await expect(primary).toBeFocused()
      const outline = await primary.evaluate((element) => {
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
      if (item === owned)
        await page.screenshot({
          path: info.outputPath(`${type}-focused-list.png`),
        })
      await page.keyboard.press(item === owned ? 'Enter' : 'Space')
      await expect(detail).toHaveText(item.title)
      await expect(
        page.getByText(`Fixture discussion for entry ${item.id}`, {
          exact: true,
        })
      ).toBeVisible()
      expect(fixture.calls).toContain(`POST /api/feedback/${item.id}/read`)
      expect(fixture.calls).toContain(`GET /api/feedback/${item.id}/comments`)
      if (item === owned)
        await page.screenshot({ path: info.outputPath(`${type}-detail.png`) })
      await back.click()
      await expect(primary).toBeVisible()
    }

    const primary = primaryFor(owned.title)
    const row = primary.locator('..')
    const beforeSiblingActions = detailCalls()
    if (type === 'feature') {
      const vote = row.getByRole('button', { name: 'Vote', exact: true })
      await tabTo(page, vote)
      await page.keyboard.press('Space')
      const remove = row.getByRole('button', {
        name: 'Remove vote',
        exact: true,
      })
      await expect(remove).toBeVisible()
      await expect(remove.locator('..').locator('span')).toHaveText('4')
      await page.keyboard.press('Enter')
      await expect(vote).toBeVisible()
      await expect(vote.locator('..').locator('span')).toHaveText('3')
      expect(
        fixture.calls.filter(
          (call) => call === `POST /api/feedback/${owned.id}/vote`
        )
      ).toHaveLength(2)
      await expect(detail).toHaveCount(0)
      expect(detailCalls()).toBe(beforeSiblingActions)
    }

    const deleteButton = row.getByRole('button', {
      name: 'Delete',
      exact: true,
    })
    await tabTo(page, deleteButton)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('alertdialog', {
      name: 'Delete entry',
      exact: true,
    })
    await expect(dialog).toBeVisible()
    await expect(detail).toHaveCount(0)
    expect(detailCalls()).toBe(beforeSiblingActions)
    expect(
      fixture.calls.filter((call) => call.startsWith('DELETE '))
    ).toHaveLength(0)
    await page.screenshot({
      path: info.outputPath(`${type}-delete-confirmation.png`),
    })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(primary).toBeVisible()
    expect(
      fixture.calls.filter((call) => call.startsWith('DELETE '))
    ).toHaveLength(0)
    await deleteButton.click()
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(primary).toHaveCount(0)
    await expect(primaryFor(community.title)).toBeVisible()
    expect(fixture.calls.filter((call) => call.startsWith('DELETE '))).toEqual([
      `DELETE /api/feedback/${owned.id}`,
    ])
    expect(detailCalls()).toBe(beforeSiblingActions)
    expect(fixture.unexpected).toEqual([])
  })
}
