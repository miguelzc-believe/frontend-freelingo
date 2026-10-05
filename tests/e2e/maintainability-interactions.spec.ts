import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, context }) => {
  await context.addCookies([
    {
      name: 'refresh_token',
      value: 'browser-fixture',
      httpOnly: true,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.addInitScript(() => {
    localStorage.setItem('fl_tour_done', '1')
    localStorage.setItem('fl_whats_new_seen_v1.9.25', '1')
    localStorage.setItem('fl_cookie_consent', 'accepted')
  })
  await page.route('**/api/admin/users?*', (route) =>
    route.fulfill({
      json: { items: [], total: 0, skip: 0, limit: 10 },
    })
  )
})

test('native create-user dialog preserves keyboard focus and light dismissal', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/admin/users')
  const trigger = page.getByRole('button', { name: 'Create User', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(
    true
  )
  const supportsLightDismiss = await page.evaluate(
    () => 'closedBy' in HTMLDialogElement.prototype
  )
  expect(supportsLightDismiss).toBe(true)
  await expect(dialog).toHaveAttribute('closedby', 'any')
  await dialog.locator('input').first().fill('Fixture User')
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab')
    expect(
      await dialog.evaluate(
        (element) =>
          // Native dialogs may move focus to browser chrome at the tab boundary.
          // BODY then represents no focused page control, not the inert background.
          document.activeElement === document.body ||
          element.contains(document.activeElement)
      )
    ).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.mouse.click(2, 2)
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  expect(errors).toEqual([])
})

test('create-user dialog preserves outside dismissal without native closedBy', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'closedBy')
  })
  await page.goto('/admin/users')
  const trigger = page.getByRole('button', { name: 'Create User', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  // Disable Chromium's native behavior to exercise the unsupported-engine fallback.
  await dialog.evaluate((element) =>
    element.setAttribute('closedby', 'closerequest')
  )
  await dialog.locator('input').first().click()
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  if (!bounds) throw new Error('Create-user dialog has no layout bounds')
  await page.mouse.click(
    bounds.x + bounds.width - 2,
    bounds.y + bounds.height - 2
  )
  await expect(dialog).toBeVisible()
  await page.mouse.click(2, 2)
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('FAQ workflow keeps authored order and usable accordion controls', async ({
  page,
}) => {
  await page.goto('/faq')
  const workflow = page.getByRole('button', {
    name: /What is the full workflow/,
  })
  await workflow.click()
  const steps = page.getByRole('listitem').filter({ has: page.locator('span') })
  await expect(steps).toHaveCount(6)
  for (let index = 0; index < 6; index++)
    await expect(steps.nth(index)).toContainText(`${index + 1}.`)
  await workflow.click()
  await expect(steps).toHaveCount(0)
})
