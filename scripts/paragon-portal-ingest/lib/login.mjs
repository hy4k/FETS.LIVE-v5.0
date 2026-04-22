/**
 * Log into the Paragon test centre portal for one centre account.
 * Locators match Playwright codegen against the live portal (username/password from .env only).
 *
 * @param {import('playwright').Page} page
 * @param {{ portalUrl: string; email: string; password: string }} creds
 */
export async function loginToPortal(page, creds) {
  const timeoutMs = 60_000
  await page.goto(creds.portalUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })

  const username = page.getByRole('textbox', { name: 'Enter username' })
  const password = page.getByRole('textbox', { name: 'Enter password' })
  const signIn = page.getByRole('button', { name: 'Sign in' })

  await username.fill(creds.email)
  await password.fill(creds.password)
  await signIn.click()

  // Login success is not a hard navigation in all environments. Wait until either:
  // - URL moves into authenticated SPA routes, or
  // - login form disappears.
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1500)

  const loggedInByUrl = /#\/(home|schedule)\b/i.test(page.url())
  const loginStillVisible = await signIn.isVisible().catch(() => false)
  if (loggedInByUrl || !loginStillVisible) {
    return
  }

  // One retry covers intermittent first-click misses in headless/datacenter sessions.
  await signIn.click().catch(() => {})
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2000)

  const loggedInAfterRetry = /#\/(home|schedule)\b/i.test(page.url())
  const loginVisibleAfterRetry = await signIn.isVisible().catch(() => false)
  if (loggedInAfterRetry || !loginVisibleAfterRetry) {
    return
  }

  const loginErrorText = (await page.locator('#error-msg, .validation-summary-errors, .alert-danger, .text-danger').first().innerText().catch(() => '')).trim()
  const pageSnippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 600)
  throw new Error(
    `Paragon login did not complete for ${creds.email}. ` +
      `errorText="${loginErrorText || 'n/a'}". ` +
      `url="${page.url()}". ` +
      `pageSnippet="${pageSnippet.replace(/\s+/g, ' ')}"`,
  )
}
