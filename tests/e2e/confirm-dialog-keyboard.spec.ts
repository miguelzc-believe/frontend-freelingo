import { expect, test } from '@playwright/test'

// Follow migration.spec.ts's real login flow and suppress unrelated onboarding.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fl_tour_done', '1')
    localStorage.setItem('fl_whats_new_seen_v1.9.25', '1')
    localStorage.setItem('fl_cookie_consent', 'accepted')
  })
  await page.goto('/login')
  await page
    .locator('[autocomplete="username"]')
    .fill('learner@example.invalid')
  await page.locator('[autocomplete="current-password"]').fill('fixture-only')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('body')).toContainText('Test Learner')
})

test('AppLayout logout dialog preserves pointer and keyboard dismissal', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile'
  const openDialog = async () => {
    if (mobile) {
      await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    }
    const opener = page.getByRole('button', { name: 'Logout', exact: true })
    await opener.focus()
    await opener.press('Enter')
    await expect(page.getByRole('alertdialog')).toBeVisible()
  }
  const dialog = page.getByRole('alertdialog', { name: 'Log Out', exact: true })
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
  const confirm = dialog.getByRole('button', { name: 'Logout', exact: true })

  await openDialog()
  await expect(cancel).toBeFocused()
  await dialog.getByText('Are you sure you want to log out?').click()
  await expect(dialog).toBeVisible()

  await cancel.focus()
  await page.keyboard.press('Tab')
  await expect(confirm).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(cancel).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(confirm).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(cancel).toBeFocused()
  await page.screenshot({ path: info.outputPath('logout-dialog.png') })

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  // Desktop retains its opener. Mobile removes the menu/opener on activation,
  // so there is no connected logout button to restore focus to in that shell.
  if (!mobile) {
    await expect(
      page.getByRole('button', { name: 'Logout', exact: true })
    ).toBeFocused()
  }

  await openDialog()
  // Use a real hit-tested viewport point outside the centered panel, not a
  // dispatched event or a forced click that would bypass stacking failures.
  await page.mouse.click(4, 4)
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/\/dashboard$/)

  await openDialog()
  await cancel.click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/\/dashboard$/)
})

// AppLayout does not supply `confirming` to its logout dialog. Deferring the
// mock logout response would not activate a busy guard; RTL covers that prop.
