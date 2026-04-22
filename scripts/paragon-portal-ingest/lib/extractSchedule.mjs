import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SELECTORS } from './selectors.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ingestRoot = path.resolve(__dirname, '..')
const artifactsDir = path.resolve(ingestRoot, '..', '..', 'output', 'playwright')
const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const scheduleName = /Schedule/i

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Build SPA home URL from login URL, e.g.
 * .../TestCentrePortal/Login -> .../TestCentrePortal/#/home
 *
 * @param {string} loginUrl
 */
function portalHomeUrlFromLoginUrl(loginUrl) {
  const u = new URL(loginUrl)
  let pathName = u.pathname.replace(/\/Login\/?$/i, '')
  if (!pathName.endsWith('/')) {
    pathName += '/'
  }
  u.pathname = pathName
  u.hash = '#/home'
  return u.toString()
}

/**
 * Build SPA schedule URL from login URL, e.g.
 * .../TestCentrePortal/Login -> .../TestCentrePortal/#/schedule
 *
 * @param {string} loginUrl
 */
function portalScheduleUrlFromLoginUrl(loginUrl) {
  const u = new URL(loginUrl)
  let pathName = u.pathname.replace(/\/Login\/?$/i, '')
  if (!pathName.endsWith('/')) {
    pathName += '/'
  }
  u.pathname = pathName
  u.hash = '#/schedule'
  return u.toString()
}

/**
 * @param {string} month
 * @returns {number}
 */
function monthKey(month) {
  const m = String(month || '').match(/^(\d{4})-(\d{2})$/)
  if (!m) return 0
  return Number(m[1]) * 12 + (Number(m[2]) - 1)
}

/**
 * @param {number} key
 */
function keyToYearMonth(key) {
  const year = Math.floor(key / 12)
  const month = (key % 12) + 1
  return { year, month }
}

/**
 * @param {string} isoDate
 * @returns {number}
 */
function dateMonthKey(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return 0
  return Number(isoDate.slice(0, 4)) * 12 + (Number(isoDate.slice(5, 7)) - 1)
}

/**
 * @param {string} isoDate
 * @param {string} startMonth
 * @param {string} endMonth
 */
function inMonthRange(isoDate, startMonth, endMonth) {
  const d = dateMonthKey(isoDate)
  const start = monthKey(startMonth)
  const end = monthKey(endMonth)
  if (!d || !start || !end) return true
  return d >= start && d <= end
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function parseIsoDate(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return null

  const iso = text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/)
  if (iso) {
    return `${iso[1]}-${String(Number(iso[2])).padStart(2, '0')}-${String(Number(iso[3])).padStart(2, '0')}`
  }

  const dmy = text.match(/\b(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])[\/-](20\d{2})\b/)
  if (dmy) {
    return `${dmy[3]}-${String(Number(dmy[2])).padStart(2, '0')}-${String(Number(dmy[1])).padStart(2, '0')}`
  }

  const monthName = text.match(
    /\b(0?[1-9]|[12]\d|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+(20\d{2})\b/i,
  )
  if (monthName) {
    const monthIndex = monthNames.indexOf(monthName[2].slice(0, 3).toLowerCase())
    if (monthIndex >= 0) {
      return `${monthName[3]}-${String(monthIndex + 1).padStart(2, '0')}-${String(Number(monthName[1])).padStart(2, '0')}`
    }
  }

  const monthNameReverse = text.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2})\b/i,
  )
  if (monthNameReverse) {
    const monthIndex = monthNames.indexOf(monthNameReverse[1].slice(0, 3).toLowerCase())
    if (monthIndex >= 0) {
      return `${monthNameReverse[3]}-${String(monthIndex + 1).padStart(2, '0')}-${String(Number(monthNameReverse[2])).padStart(2, '0')}`
    }
  }

  return null
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function parseTime(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return null

  const m = text.match(/\b(0?[1-9]|1[0-2]):([0-5]\d)\s*([AaPp][Mm])\b/)
  if (m) {
    let hour = Number(m[1]) % 12
    if (m[3].toLowerCase() === 'pm') hour += 12
    return `${String(hour).padStart(2, '0')}:${m[2]}`
  }

  const m24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (m24) {
    return `${String(Number(m24[1])).padStart(2, '0')}:${m24[2]}`
  }

  return null
}

/**
 * @param {string} text
 */
function parseBookedCapacity(text) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim()
  if (!compact) return null

  const slash = compact.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/)
  if (slash) {
    return { bookedCount: Number(slash[1]), capacity: Number(slash[2]) }
  }

  const ofPattern = compact.match(/\b(\d{1,3})\s+(?:of|out of)\s+(\d{1,3})\b/i)
  if (ofPattern) {
    return { bookedCount: Number(ofPattern[1]), capacity: Number(ofPattern[2]) }
  }

  const booked = compact.match(/\bBooked(?:\s*Count)?\s*[:\-]?\s*(\d{1,3})\b/i)
  const capacity = compact.match(/\bCapacity\s*[:\-]?\s*(\d{1,3})\b/i)
  if (booked && capacity) {
    return { bookedCount: Number(booked[1]), capacity: Number(capacity[1]) }
  }

  return null
}

/**
 * @param {string} text
 * @returns {string}
 */
function parseTestType(text) {
  const t = String(text || '').toLowerCase()
  if (/\bls\b|\blistening\s*and\s*speaking\b/.test(t)) return 'LS'
  if (/\bgeneral\b|\bcelpip[-\s]*g\b|\b g\b/.test(t)) return 'G'
  return 'G'
}

/**
 * @param {string} isoDate
 * @param {string} hhmm
 * @param {string} testType
 * @param {number} duplicateIndex
 */
function buildSlotId(isoDate, hhmm, testType, duplicateIndex) {
  const month = Number(isoDate.slice(5, 7))
  const day = isoDate.slice(8, 10)
  const base = `${monthNames[month - 1] || 'm'}-${day}-${hhmm.replace(':', '')}-${testType.toLowerCase()}`
  if (duplicateIndex <= 1) return base
  return `${base}-${duplicateIndex}`
}

/**
 * @param {import('playwright').Page} page
 * @param {string} homeUrl
 * @param {number} timeoutMs
 */
async function ensureHomeLoaded(page, homeUrl, timeoutMs) {
  const current = page.url()
  if (/#\/(home|schedule)\b/i.test(current)) {
    return
  }

  /** @type {Error | undefined} */
  let lastErr
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
      await page.waitForLoadState('domcontentloaded')
      return
    } catch (error) {
      lastErr = error instanceof Error ? error : new Error(String(error))
      if (!/ERR_ABORTED/i.test(lastErr.message)) {
        throw lastErr
      }
      await sleep(1_000 * attempt)
    }
  }

  throw lastErr ?? new Error('Could not load Paragon home view')
}

/**
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs
 */
async function clickScheduleNav(page, timeoutMs) {
  const perTry = Math.min(20_000, timeoutMs)
  const strategies = [
    () => page.getByRole('link', { name: scheduleName }),
    () => page.getByRole('button', { name: scheduleName }),
    () => page.getByRole('menuitem', { name: scheduleName }),
    () => page.locator('a[href*="schedule" i]'),
    () => page.locator('a').filter({ hasText: scheduleName }),
  ]

  /** @type {Error | undefined} */
  let lastErr
  for (const makeLocator of strategies) {
    const locator = makeLocator().first()
    try {
      await locator.waitFor({ state: 'visible', timeout: perTry })
      await locator.scrollIntoViewIfNeeded().catch(() => {})
      await locator.click({ timeout: perTry })
      return
    } catch (error) {
      lastErr = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastErr ?? new Error('Could not find Schedule navigation')
}

/**
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs
 * @returns {Promise<import('playwright').Locator>}
 */
async function findScheduleRoot(page, timeoutMs) {
  const candidates = [SELECTORS.schedule.root, '[role="grid"]', 'table', '.table-responsive', '.k-grid-content']
  for (const selector of candidates) {
    const loc = page.locator(selector).first()
    try {
      await loc.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 15_000) })
      return loc
    } catch {
      // try next selector
    }
  }
  throw new Error('Schedule root not found')
}

/**
 * @param {import('playwright').Locator} root
 */
async function extractRowTexts(root) {
  const rowSelector = SELECTORS.schedule.row
  let rows = root.locator(rowSelector)
  let count = await rows.count()

  if (!count) {
    rows = root.locator('tbody tr, [role="row"], .k-master-row, .mat-row')
    count = await rows.count()
  }

  /** @type {string[]} */
  const texts = []
  for (let i = 0; i < count; i += 1) {
    const text = (await rows.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
    if (!text) continue
    if (/^date\s+time\b/i.test(text) || /^time\s+date\b/i.test(text)) continue
    texts.push(text)
  }
  return texts
}

/**
 * @param {string[]} rowTexts
 * @param {string} startMonth
 * @param {string} endMonth
 */
function parseRows(rowTexts, startMonth, endMonth) {
  /** @type {Array<{ id: string; date: string; time: string; testType: string; bookedCount: number; capacity: number }>} */
  const out = []
  /** @type {Map<string, number>} */
  const seen = new Map()

  for (const rowText of rowTexts) {
    const date = parseIsoDate(rowText)
    const time = parseTime(rowText)
    const counts = parseBookedCapacity(rowText)
    if (!date || !time || !counts) continue
    if (!inMonthRange(date, startMonth, endMonth)) continue

    const testType = parseTestType(rowText)
    const key = `${date}|${time}|${testType}`
    const nextCount = (seen.get(key) ?? 0) + 1
    seen.set(key, nextCount)

    out.push({
      id: buildSlotId(date, time, testType, nextCount),
      date,
      time,
      testType,
      bookedCount: Math.max(0, Math.floor(counts.bookedCount)),
      capacity: Math.max(0, Math.floor(counts.capacity)),
    })
  }

  return out
}

/**
 * @param {number} year
 * @param {number} monthOneBased
 * @param {number} delta
 */
function shiftMonth(year, monthOneBased, delta) {
  const total = year * 12 + (monthOneBased - 1) + delta
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return { year: y, month: m }
}

/**
 * @param {string} monthLabel
 */
function parseMonthLabel(monthLabel) {
  const m = String(monthLabel || '').match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b[^0-9]*(20\d{2})/i,
  )
  if (!m) return null
  const monthIndex =
    [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ].indexOf(m[1].toLowerCase()) + 1
  if (!monthIndex) return null
  return { year: Number(m[2]), month: monthIndex }
}

/**
 * @param {number} day
 * @param {boolean} isOtherMonth
 * @param {number} rowIndex
 * @param {{ year: number; month: number }} currentMonth
 */
function buildDateFromCell(day, isOtherMonth, rowIndex, currentMonth) {
  let target = currentMonth
  if (isOtherMonth) {
    target = day >= 20 && rowIndex <= 1 ? shiftMonth(currentMonth.year, currentMonth.month, -1) : shiftMonth(currentMonth.year, currentMonth.month, 1)
  }
  return `${target.year}-${String(target.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * @param {import('playwright').Page} page
 */
async function extractKendoEvents(page) {
  return page.evaluate(() => {
    const scheduler = document.querySelector('#scheduler')
    if (!scheduler) return []

    const monthLabel =
      scheduler.querySelector('.k-nav-current .k-lg-date-format')?.textContent ??
      scheduler.querySelector('.k-nav-current .k-sm-date-format')?.textContent ??
      ''

    const cells = []
    const rowEls = scheduler.querySelectorAll('.k-scheduler-content table.k-scheduler-table tbody tr[role="row"]')
    rowEls.forEach((rowEl, rowIndex) => {
      rowEl.querySelectorAll('td[role="gridcell"]').forEach((cellEl, colIndex) => {
        const dayText = cellEl.querySelector('.k-nav-day')?.textContent?.trim() ?? ''
        const day = Number(dayText)
        if (!day) return
        const rect = cellEl.getBoundingClientRect()
        cells.push({
          rowIndex,
          colIndex,
          day,
          isOtherMonth: cellEl.classList.contains('k-other-month'),
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        })
      })
    })

    const events = []
    scheduler.querySelectorAll('.k-scheduler-content .k-event').forEach((eventEl) => {
      const eventRect = eventEl.getBoundingClientRect()
      const x = eventRect.left + 8
      const y = eventRect.top + 8

      let matched = cells.find((c) => x >= c.left && x <= c.right && y >= c.top && y <= c.bottom)
      if (!matched && cells.length) {
        matched = cells
          .map((c) => {
            const cx = (c.left + c.right) / 2
            const cy = (c.top + c.bottom) / 2
            const dx = cx - x
            const dy = cy - y
            return { c, d2: dx * dx + dy * dy }
          })
          .sort((a, b) => a.d2 - b.d2)[0]?.c
      }

      events.push({
        text: (eventEl.textContent ?? '').replace(/\s+/g, ' ').trim(),
        rowIndex: matched?.rowIndex ?? -1,
        day: matched?.day ?? 0,
        isOtherMonth: Boolean(matched?.isOtherMonth),
        monthLabel,
      })
    })

    return events
  })
}

/**
 * @param {import('playwright').Page} page
 * @param {string} startMonth
 * @param {string} endMonth
 * @param {number | null} onlyMonthKey
 */
async function parseKendoBookings(page, startMonth, endMonth, onlyMonthKey = null) {
  const rawEvents = await extractKendoEvents(page)
  if (!rawEvents.length) return []

  const label = parseMonthLabel(rawEvents[0]?.monthLabel ?? '')
  if (!label) return []

  /** @type {Array<{ id: string; date: string; time: string; testType: string; bookedCount: number; capacity: number }>} */
  const out = []
  /** @type {Map<string, number>} */
  const seen = new Map()

  for (const event of rawEvents) {
    if (!event.day || event.rowIndex < 0) continue
    const date = buildDateFromCell(Number(event.day), Boolean(event.isOtherMonth), Number(event.rowIndex), label)
    if (onlyMonthKey !== null && dateMonthKey(date) !== onlyMonthKey) continue
    const time = parseTime(event.text)
    const counts = parseBookedCapacity(event.text)
    if (!time || !counts) continue
    if (!inMonthRange(date, startMonth, endMonth)) continue

    const testType = parseTestType(event.text)
    const key = `${date}|${time}|${testType}`
    const duplicate = (seen.get(key) ?? 0) + 1
    seen.set(key, duplicate)

    out.push({
      id: buildSlotId(date, time, testType, duplicate),
      date,
      time,
      testType,
      bookedCount: Math.max(0, Math.floor(counts.bookedCount)),
      capacity: Math.max(0, Math.floor(counts.capacity)),
    })
  }

  return out
}

/**
 * @param {import('playwright').Page} page
 */
async function getCurrentSchedulerMonthKey(page) {
  const label = (await page.locator('#scheduler .k-nav-current .k-lg-date-format, #scheduler .k-nav-current .k-sm-date-format').first().innerText().catch(() => '')).trim()
  const parsed = parseMonthLabel(label)
  if (!parsed) return null
  return parsed.year * 12 + (parsed.month - 1)
}

/**
 * @param {import('playwright').Page} page
 * @param {'next' | 'prev'} direction
 * @param {number} timeoutMs
 */
async function stepSchedulerMonth(page, direction, timeoutMs) {
  const btnSelector = direction === 'next' ? '#scheduler .k-nav-next .k-link' : '#scheduler .k-nav-prev .k-link'
  const before = await getCurrentSchedulerMonthKey(page)
  await page.locator(btnSelector).first().click({ timeout: timeoutMs })

  await page
    .waitForFunction(
      ({ prev }) => {
        const label =
          document.querySelector('#scheduler .k-nav-current .k-lg-date-format')?.textContent ??
          document.querySelector('#scheduler .k-nav-current .k-sm-date-format')?.textContent ??
          ''
        const m = label.match(
          /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b[^0-9]*(20\d{2})/i,
        )
        if (!m) return false
        const months = {
          january: 1,
          february: 2,
          march: 3,
          april: 4,
          may: 5,
          june: 6,
          july: 7,
          august: 8,
          september: 9,
          october: 10,
          november: 11,
          december: 12,
        }
        const month = months[m[1].toLowerCase()]
        const key = Number(m[2]) * 12 + (month - 1)
        return Number.isFinite(key) && key !== prev
      },
      { prev: before },
      { timeout: timeoutMs },
    )
    .catch(() => {})

  await sleep(600)
}

/**
 * @param {import('playwright').Page} page
 * @param {number} targetKey
 * @param {number} timeoutMs
 */
async function goToSchedulerMonth(page, targetKey, timeoutMs) {
  let current = await getCurrentSchedulerMonthKey(page)
  if (current === null) return false

  for (let i = 0; i < 16; i += 1) {
    if (current === targetKey) return true
    const direction = current < targetKey ? 'next' : 'prev'
    await stepSchedulerMonth(page, direction, timeoutMs)
    current = await getCurrentSchedulerMonthKey(page)
    if (current === null) return false
  }

  return current === targetKey
}

/**
 * @param {import('playwright').Page} page
 * @param {string} startMonth
 * @param {string} endMonth
 * @param {number} timeoutMs
 */
async function collectKendoBookingsAcrossRange(page, startMonth, endMonth, timeoutMs) {
  const start = monthKey(startMonth)
  const end = monthKey(endMonth)
  if (!start || !end || end < start) return []

  /** @type {Map<string, { id: string; date: string; time: string; testType: string; bookedCount: number; capacity: number }>} */
  const merged = new Map()

  for (let mk = start; mk <= end; mk += 1) {
    const moved = await goToSchedulerMonth(page, mk, timeoutMs)
    if (!moved) continue

    const monthRows = await parseKendoBookings(page, startMonth, endMonth, mk)
    for (const row of monthRows) {
      merged.set(row.id, row)
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * @param {import('playwright').Page} page
 * @param {string} centreKey
 */
async function writeDebugArtifacts(page, centreKey) {
  await fs.mkdir(artifactsDir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const base = `${centreKey}-${ts}`
  const screenshotPath = path.join(artifactsDir, `${base}.png`)
  const htmlPath = path.join(artifactsDir, `${base}.html`)
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
  const html = await page.content().catch(() => '')
  if (html) {
    await fs.writeFile(htmlPath, html, 'utf8')
  }
  return { screenshotPath, htmlPath }
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
  const scheduleUrl = portalScheduleUrlFromLoginUrl(opts.portalUrl)
  const navTimeout = 60_000

  await ensureHomeLoaded(page, homeUrl, navTimeout)
  await sleep(1_500)
  try {
    await clickScheduleNav(page, navTimeout)
  } catch {
    // Unattended sessions can miss sidebar render timing; direct hash route is a safe fallback.
    await page.goto(scheduleUrl, { waitUntil: 'domcontentloaded', timeout: navTimeout })
  }
  await page.waitForLoadState('domcontentloaded')
  await sleep(1_500)

  // In some headless sessions, table/root wrappers render differently while Kendo events are present.
  // Try direct Kendo extraction first so we don't fail early on container selector drift.
  const kendoBookings = await collectKendoBookingsAcrossRange(page, opts.startMonth, opts.endMonth, navTimeout)
  if (kendoBookings.length > 0) {
    return kendoBookings
  }

  let root
  try {
    root = await findScheduleRoot(page, navTimeout)
  } catch (error) {
    const artifacts = await writeDebugArtifacts(page, opts.centreKey)
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Schedule root not found for ${opts.centreKey}. ` +
        `${msg}. Artifacts: screenshot=${artifacts.screenshotPath}, html=${artifacts.htmlPath}`,
    )
  }

  const rowTexts = await extractRowTexts(root)
  const bookings = parseRows(rowTexts, opts.startMonth, opts.endMonth)

  if (bookings.length === 0) {
    const artifacts = await writeDebugArtifacts(page, opts.centreKey)
    const sample = rowTexts.slice(0, 8)
    throw new Error(
      `Schedule page loaded but no rows parsed for ${opts.centreKey}. ` +
        `rowsSeen=${rowTexts.length}. sampleRows=${JSON.stringify(sample)}. ` +
        `Artifacts: screenshot=${artifacts.screenshotPath}, html=${artifacts.htmlPath}`,
    )
  }

  return bookings
}
