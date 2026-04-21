/**
 * Log into the Paragon test centre portal for one centre account.
 * Locators match Playwright codegen against the live portal (username/password from .env only).
 *
 * @param {import('playwright').Page} page
 * @param {{ portalUrl: string; email: string; password: string }} creds
 */
export async function loginToPortal(page, creds) {
  await page.goto(creds.portalUrl, { waitUntil: 'domcontentloaded' })

  await page.getByRole('textbox', { name: 'Enter username' }).fill(creds.email)
  await page.getByRole('textbox', { name: 'Enter password' }).fill(creds.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await page.waitForLoadState('domcontentloaded')
}
