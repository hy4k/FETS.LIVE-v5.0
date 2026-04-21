/**
 * Build SPA home URL from login URL, e.g.
 * .../TestCentrePortal/Login → .../TestCentrePortal/#/home
 *
 * Paragon’s router expects a trailing slash before the hash (`/TestCentrePortal/#/home`).
 * Without it, `new URL` stringifies as `.../TestCentrePortal#/home` and navigation can abort (net::ERR_ABORTED).
 *
 * @param {string} loginUrl
 */
function portalHomeUrlFromLoginUrl(loginUrl) {
  const u = new URL(loginUrl)
  let path = u.pathname.replace(/\/Login\/?$/i, '')
  if (!path.endsWith('/')) {
    path += '/'
  }
  u.pathname = path
  u.hash = '#/home'
  return u.toString()
}

const scheduleName = /Schedule/i

/**
 * Codegen used `getByRole('link', { name: 'Schedule 📅' })`. Emoji / exact names often differ
 * between headed/headless or builds, so try link → button → menuitem → href → generic anchor.
 *
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs
 */
async function clickScheduleNav(page, timeoutMs) {
  const perTry = Math.min(25_000, timeoutMs)
  const strategies = [
    () => page.getByRole('link', { name: scheduleName }),
    () => page.getByRole('button', { name: scheduleName }),
    () => page.getByRole('menuitem', { name: scheduleName }),
    () => page.locator('a[href*="schedule" i]'),
    () => page.locator('a').filter({ hasText: scheduleName }),
  ]

  /** @type {Error | undefined} */
  let lastErr
  for (const make of strategies) {
    const loc = make().first()
    try {
      await loc.waitFor({ state: 'visible', timeout: perTry })
      await loc.scrollIntoViewIfNeeded().catch(() => {})
      await loc.click({ timeout: perTry })
      return
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }

  throw lastErr ?? new Error('Could not find Schedule navigation')
}

/**
 * After login: open home + Schedule, then scrape rows.
 *
 * @param {import('playwright').Page} page
 * @param {{ portalUrl: string; startMonth: string; endMonth: string; centreKey: string }} opts
 * @returns {Promise<Array<{ id: string; date: string; time: string; testType: string; bookedCount: number; capacity: number }>>}
 */
export async function extractBookingsForCentre(page, opts) {
  const homeUrl = portalHomeUrlFromLoginUrl(opts.portalUrl)
  const navTimeout = 60_000

  await page.goto(homeUrl, { waitUntil: 'load', timeout: navTimeout })
  await page.waitForLoadState('domcontentloaded')

  // Hash SPAs often mount the shell shortly after first paint.
  await new Promise((r) => setTimeout(r, 1500))

  await clickScheduleNav(page, navTimeout)
  await page.waitForLoadState('domcontentloaded')

  // TODO: import { SELECTORS } from './selectors.mjs' and replace SELECTORS.schedule.* from codegen, then:
  // const root = page.locator(SELECTORS.schedule.root)
  // await root.waitFor({ state: 'visible', timeout: 60_000 })
  // const rows = root.locator(SELECTORS.schedule.row)
  // for (let i = 0; i < await rows.count(); i++) { ... push booking objects }

  console.warn(
    `[extractBookingsForCentre:${opts.centreKey}] Schedule page opened — row scraping not implemented yet. ` +
      'Fill SELECTORS.schedule in selectors.mjs and implement the row loop below.',
  )

  return []
}
