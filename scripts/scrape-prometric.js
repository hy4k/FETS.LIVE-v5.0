#!/usr/bin/env node
/**
 * CMA Prometric Seat Availability Scraper v2
 *
 * Navigates the ProScheduler wizard (Seat Availability flow) for all 4 CMA exam
 * types, searches Kerala in 7-day windows across May–June, and upserts available
 * dates for Cochin (5290) and Calicut (4960) into the `cma_availability` table.
 *
 * CAPTCHA: appears the first time per session. Run once with --headless=false so
 * you can solve it manually; the session cookie is saved and reused in CI.
 *
 * Usage:
 *   node scripts/scrape-prometric.js                   # headless (uses saved cookie)
 *   node scripts/scrape-prometric.js --headless=false   # visible browser (solve CAPTCHA)
 *   node scripts/scrape-prometric.js --from=2026-05-01 --to=2026-06-30
 *   node scripts/scrape-prometric.js --capture          # record API calls → scripts/api-capture.json
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../fets-point/.env') });
dotenvConfig({ path: resolve(__dirname, '../.env') });

// ── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE env vars. Check .env or GitHub Secrets.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const HOME_URL    = 'https://proscheduler.prometric.com/';
const BASE_URL    = 'https://proscheduler.prometric.com/scheduling/findAvailabilityTestcenter';
const SPONSOR     = 'Institute of Certified Management Accountants';
const COOKIE_PATH = resolve(__dirname, '../.prometric-session.json');

const CENTERS = [
  { id: 'cochin',  siteId: '5290', city: 'Kochi' },
  { id: 'calicut', siteId: '4960', city: 'Kozhikode' },
];

// All 4 exam types — we search each one separately and merge Part 1 results together
const EXAM_TYPES = [
  { part: '1', label: 'Part 1 CMA Exam- Case Based Questions' },
  { part: '1', label: 'Part 1 CMA Exam- Essay' },
  { part: '2', label: 'Part 2 CMA Exam- Case Based Questions' },
  { part: '2', label: 'Part 2 CMA Exam- Essay' },
];

// ── CLI args ───────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const HEADLESS  = args.headless !== 'false';
const CAPTURE   = !!args.capture;
const DEBUG     = !!args.debug;     // take screenshots + dump HTML for selector debugging
const YEAR      = new Date().getFullYear();
const DATE_FROM = args.from || `${YEAR}-05-01`;
const DATE_TO   = args.to   || `${YEAR}-06-30`;
const CAPTURE_PATH = resolve(__dirname, 'api-capture.json');
const DEBUG_DIR    = resolve(__dirname, '../debug-screenshots');

// ── Date helpers ───────────────────────────────────────────────────────────

// Use local-date construction to avoid UTC offset shifting dates
function isoToDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight — no UTC conversion
}
function dateToISO(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Single wide window covering the full date range (avoids per-window CAPTCHAs)
function buildWindows() {
  return [{ start: DATE_FROM, end: DATE_TO }];
}

// ── Browser context ────────────────────────────────────────────────────────

async function buildContext(browser) {
  const capturedRequests = [];

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport:  { width: 1366, height: 768 },
    locale:    'en-US',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
  });

  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });

  // Intercept API calls when --capture is used
  if (CAPTURE) {
    ctx.on('request', req => {
      const url = req.url();
      const method = req.method();
      if (!url.includes('prometric') && !url.includes('proscheduler')) return;
      if (['GET','POST','PUT'].includes(method)) {
        capturedRequests.push({
          method,
          url,
          headers: req.headers(),
          postData: req.postData() || null,
        });
      }
    });
    ctx.on('response', async res => {
      const url = res.url();
      if (!url.includes('prometric') && !url.includes('proscheduler')) return;
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('json')) {
        const body = await res.text().catch(() => '');
        const entry = capturedRequests.find(r => r.url === url);
        if (entry) entry.responseBody = body.slice(0, 2000);
      }
    });
  }

  // Load saved cookies
  if (existsSync(COOKIE_PATH)) {
    try {
      const cookies = JSON.parse(readFileSync(COOKIE_PATH, 'utf8'));
      await ctx.addCookies(cookies);
      console.log('🍪  Restored session cookies from', COOKIE_PATH);
    } catch (e) {
      console.warn('⚠️   Could not load cookies:', e.message);
    }
  } else {
    console.log('ℹ️   No saved session — run once with --headless=false to solve CAPTCHA.');
  }

  return ctx;
}

// ── CAPTCHA detection & handling ───────────────────────────────────────────

async function checkCaptcha(page) {
  // reCAPTCHA / hCaptcha (iframe-based)
  const hasCaptchaFrame = await page.locator([
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="captcha"]',
    'iframe[title*="captcha" i]',
    '[data-sitekey]',
    '.g-recaptcha',
    '.h-captcha',
  ].join(', ')).count() > 0;

  const bodyText = await page.textContent('body').catch(() => '');

  // Cloudflare challenge
  const isChallenge = /just a moment|checking your browser/i.test(bodyText);

  // Prometric text-image CAPTCHA ("Please complete the captcha and select next to proceed")
  const hasTextCaptcha = /complete the captcha/i.test(bodyText);

  return hasCaptchaFrame || isChallenge || hasTextCaptcha;
}

// Returns false if CAPTCHA is unresolvable (headless mode — abort run)
async function handleCaptcha(page, location) {
  if (!(await checkCaptcha(page))) return true;

  if (!HEADLESS) {
    console.log(`\n🔐  CAPTCHA at: ${location}`);
    console.log('    *** SOLVE THE CAPTCHA IN THE BROWSER WINDOW ***');
    console.log('    Watching automatically — you have 15 minutes…');
    // Beep to grab attention
    process.stdout.write('\x07\x07\x07');
    try {
      await page.waitForFunction(
        () => !/complete the captcha/i.test(document.body?.textContent || ''),
        { timeout: 900_000, polling: 1000 }
      );
      console.log('    ✅  CAPTCHA solved — continuing…');
      await page.waitForTimeout(1000);
      return true;
    } catch {
      console.warn('    ⚠️   CAPTCHA not solved within 15 minutes — skipping');
      return false;
    }
  }

  console.warn(`\n⛔  CAPTCHA in headless mode at: ${location}`);
  console.warn('    Run with --headless=false to solve it and save the session cookie.');
  return false;
}

// ── Dropdown selection ─────────────────────────────────────────────────────

/**
 * Find the <select> that contains the given option text and select it.
 * Searches all <select> elements — avoids index-based selection which is fragile
 * when the language select or other selects appear before the target.
 * NEVER tries to click <option> elements (they are not visible in DOM).
 */
async function selectOption(page, _ignored, optionText) {
  // Strategy 1: find any <select> whose <option> list contains the target text
  const selects = page.locator('select');
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const sel = selects.nth(i);
    // Check options via evaluate (faster than Playwright locator chain)
    const hasIt = await sel.evaluate(
      (el, text) => [...el.options].some(o => o.text.trim().includes(text)),
      optionText
    ).catch(() => false);
    if (hasIt) {
      await sel.selectOption({ label: optionText });
      await page.waitForTimeout(800);
      return true;
    }
  }

  // Strategy 2: custom combobox (React-Select, etc.)
  const combos = page.locator('[role="combobox"], .select__control, [class*="dropdown-toggle"]');
  const comboCount = await combos.count();
  for (let i = 0; i < comboCount; i++) {
    try {
      await combos.nth(i).click();
      await page.waitForTimeout(400);
      const opt = page.getByRole('option', { name: optionText, exact: false }).first();
      if (await opt.count() > 0) {
        await opt.click();
        await page.waitForTimeout(800);
        return true;
      }
      await page.keyboard.press('Escape');
    } catch { /* try next */ }
  }

  return false;
}

// ── Date input filling ─────────────────────────────────────────────────────

/**
 * Fill a date field. Tries:
 *   1. input[type="date"]  → ISO yyyy-mm-dd
 *   2. text input with MM/DD/YYYY pattern (triple-click then type)
 */
async function fillDateInput(locator, iso) {
  const tagName = await locator.evaluate(el => el.tagName).catch(() => 'INPUT');
  const inputType = await locator.evaluate(el => el.type).catch(() => 'text');

  if (inputType === 'date') {
    await locator.fill(iso);
    return;
  }

  // Text field — use MM/DD/YYYY
  const [y, m, d] = iso.split('-');
  const formatted = `${m}/${d}/${y}`;
  await locator.click({ clickCount: 3 });
  await locator.fill('');
  await locator.type(formatted, { delay: 40 });

  // Trigger change events (some date pickers need this)
  await locator.press('Tab');
  await page.waitForTimeout(300).catch(() => {});
}

// ── Step 1 wizard: navigate through sponsor → program → exam type ──────────

async function debugDump(page, label) {
  if (!DEBUG) return;
  mkdirSync(DEBUG_DIR, { recursive: true });
  const slug = label.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const ss   = resolve(DEBUG_DIR, `${slug}.png`);
  const html = resolve(DEBUG_DIR, `${slug}.html`);
  await page.screenshot({ path: ss, fullPage: true });
  writeFileSync(html, await page.content());
  console.log(`    📸  Debug: ${ss}`);
}

// Detect and wait through Prometric's virtual queue page.
// The queue JS polls an API and auto-redirects when position reaches 0.
async function waitThroughQueue(page) {
  const bodyText = await page.textContent('body').catch(() => '');
  const isQueue = /scheduling queue|place in the queue|queue position/i.test(bodyText);
  if (!isQueue) return true;

  const pos = bodyText.match(/position in the queue is:?\s*\n?\s*(\d+)/i)?.[1] || '?';
  console.log(`    ⏳  Queue detected (position: ${pos}) — waiting for auto-redirect (up to 10 min)…`);

  try {
    // Wait for the queue JS to redirect us away from this page
    await page.waitForFunction(
      () => !/scheduling queue|place in the queue/i.test(document.body?.textContent || ''),
      { timeout: 600_000, polling: 3000 }
    );
    await page.waitForTimeout(2000);
    console.log('    ✅  Queue cleared — proceeding…');
    return true;
  } catch {
    console.warn('    ⚠️   Queue timed out after 10 min — try running during off-peak hours');
    return false;
  }
}

async function navigateWizardStep1(page, examTypeLabel) {
  // Start from the home page (navigating directly to the scheduling URL triggers the queue).
  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 40_000 });
  await page.waitForTimeout(3000);

  // Wait through the queue BEFORE trying to interact with anything
  const queueOk = await waitThroughQueue(page);
  if (!queueOk) return false;

  await debugDump(page, '01-home-page');

  // The home page shows 5 tiles. "Search Availability" tile text is rendered as
  // an image label — find it via alt text or any element containing that text.
  const tileSelectors = [
    'img[alt*="Search" i]',
    'img[alt*="Availability" i]',
    '[title*="Search Availability" i]',
    'a[href*="findAvailability" i]',
    'a[href*="search" i]',
  ];

  let clicked = false;
  for (const sel of tileSelectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) {
      await el.click();
      clicked = true;
      console.log(`    🖱️   Clicked tile via: ${sel}`);
      break;
    }
  }

  if (!clicked) {
    // Dump all img alt texts and link hrefs so we can find the right selector
    if (DEBUG) {
      const info = await page.evaluate(() => ({
        imgs: [...document.querySelectorAll('img')].map(i => ({ alt: i.alt, src: i.src.split('/').pop(), title: i.title })),
        links: [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 60) })),
        allText: document.body.innerText.slice(0, 800),
      }));
      console.log('    🔍  Home page content:', JSON.stringify(info, null, 2));
    }
    console.warn('    ⚠️   Could not find Search Availability tile');
    return false;
  }

  // Wait for the sponsor dropdown to fully load its options (spinner clears)
  try {
    await page.waitForFunction(
      () => {
        const sel = document.querySelector('select#test_sponsor');
        return sel && sel.options.length > 1; // > 1 means options loaded from API
      },
      { timeout: 20_000 }
    );
  } catch {
    console.warn('    ⚠️   Sponsor dropdown did not load within 20s — site may be slow');
  }

  await debugDump(page, '02-after-tile-click');

  if (!(await handleCaptcha(page, 'after tile click'))) return false;

  // Log what interactive elements actually exist on the sponsor form page
  if (DEBUG) {
    const info = await page.evaluate(() => {
      const selects  = [...document.querySelectorAll('select')].map(el => ({
        tag: 'select', id: el.id, name: el.name, options: [...el.options].map(o => o.text).slice(0, 5),
      }));
      const inputs   = [...document.querySelectorAll('input:not([type=hidden])')].map(el => ({
        tag: 'input', type: el.type, id: el.id, name: el.name, placeholder: el.placeholder,
      }));
      const buttons  = [...document.querySelectorAll('button, [role=button], a[href]')].map(el => ({
        tag: el.tagName, text: el.textContent.trim().slice(0, 60),
      }));
      const combos   = [...document.querySelectorAll('[role=combobox],[role=listbox],[class*=select],[class*=dropdown]')].map(el => ({
        tag: el.tagName, role: el.getAttribute('role'), class: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60),
      }));
      return { selects, inputs, buttons: buttons.slice(0, 10), combos: combos.slice(0, 10) };
    });
    console.log('    🔍  Page elements:', JSON.stringify(info, null, 2));
  }

  // ── Sponsor ──────────────────────────────────────────────────────────────
  // Target by known ID so we never accidentally pick the language selector
  const sponsorSel = page.locator('select#test_sponsor');
  if (await sponsorSel.count() === 0) {
    await debugDump(page, '03-sponsor-not-found');
    console.warn('    ⚠️   select#test_sponsor not found');
    return false;
  }
  await sponsorSel.selectOption({ label: SPONSOR });
  await page.waitForTimeout(2000);
  await debugDump(page, '03-after-sponsor');

  // ── Program ───────────────────────────────────────────────────────────────
  // After sponsor, a "Select a Program" dropdown cascades in.
  // Wait for the select count to grow beyond the initial 2 (lang + sponsor).
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('select').length > 2,
      { timeout: 8000 }
    );
  } catch {
    console.warn('    ⚠️   Program dropdown did not appear after sponsor selection');
  }
  await page.waitForTimeout(600);

  // Pick the program: find any select that is NOT lang-select-dropdown or test_sponsor
  // and contains ICMA as an option, then select it.
  const programOk = await page.evaluate((sponsor) => {
    for (const sel of document.querySelectorAll('select')) {
      if (sel.id === 'lang-select-dropdown' || sel.id === 'test_sponsor') continue;
      const opt = [...sel.options].find(o => o.text.trim().includes(sponsor));
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }, SPONSOR);

  if (!programOk) {
    // Maybe there is no separate program step for ICMA — proceed anyway
    console.log('    ℹ️   No program dropdown found — may not be required for this sponsor');
  }
  await page.waitForTimeout(2000);
  await debugDump(page, '04-after-program');

  // ── Exam Type ─────────────────────────────────────────────────────────────
  // After program selection the exam type dropdown cascades in.
  // Wait for a <select> whose options include CMA-specific text.
  let examSelectLocator = null;
  try {
    await page.waitForFunction(
      () => [...document.querySelectorAll('select')].some(
        sel => sel.id !== 'lang-select-dropdown' && sel.id !== 'test_sponsor'
             && [...sel.options].some(o => /CMA Exam|Part [12]/i.test(o.text))
      ),
      { timeout: 10_000 }
    );
  } catch {
    console.warn('    ⚠️   Exam type dropdown with CMA options did not appear');
  }
  await page.waitForTimeout(400);

  // Dump all selects for debugging
  if (DEBUG) {
    const allSels = await page.evaluate(() =>
      [...document.querySelectorAll('select')].map(s => ({
        id: s.id, value: s.value,
        options: [...s.options].map(o => o.text.trim()).slice(0, 10),
      }))
    );
    console.log('    🔍  Selects after program:', JSON.stringify(allSels, null, 2));
  }

  // Find the exam select using Playwright (proper React-compatible selectOption)
  const allSelects = page.locator('select');
  const selCount = await allSelects.count();
  let examOk = false;
  for (let i = 0; i < selCount; i++) {
    const sel = allSelects.nth(i);
    const id = await sel.getAttribute('id').catch(() => '');
    if (id === 'lang-select-dropdown' || id === 'test_sponsor') continue;

    const hasCMAOptions = await sel.evaluate(
      el => [...el.options].some(o => /CMA Exam|Part [12]/i.test(o.text))
    ).catch(() => false);
    if (!hasCMAOptions) continue;

    // This is the exam type select — use Playwright's selectOption (fires React events)
    try {
      await sel.selectOption({ label: examTypeLabel });
      examSelectLocator = sel;
      examOk = true;
      break;
    } catch {
      // Exact label failed — try partial match
      const partialLabel = await sel.evaluate((el, lbl) => {
        const opt = [...el.options].find(o => o.text.trim().includes(lbl.slice(0, 25)));
        return opt ? opt.text.trim() : null;
      }, examTypeLabel);
      if (partialLabel) {
        await sel.selectOption({ label: partialLabel });
        examSelectLocator = sel;
        examOk = true;
        break;
      }
    }
  }

  if (!examOk) {
    await debugDump(page, '05-exam-failed');
    console.warn(`    ⚠️   Could not select exam type: ${examTypeLabel}`);
    return false;
  }
  await page.waitForTimeout(1000);
  await debugDump(page, '05-after-exam-type');

  // ── Next ──────────────────────────────────────────────────────────────────
  const nextBtn = page.locator('button').filter({ hasText: /next/i }).first();
  if (await nextBtn.count() === 0) {
    console.warn('    ⚠️   Next button not found');
    return false;
  }
  await nextBtn.click();
  await page.waitForTimeout(2500);
  await debugDump(page, '06-after-next');
  return true;
}

// ── Step 2: fill location + dates, submit, parse results ──────────────────

async function searchAndParse(page, dateWindow) {
  // ── Guard: ensure we're on the date-search step (step 2) ─────────────────
  // If #locationStartDate is absent the wizard wasn't completed — signal caller.
  const onStep2 = await page.locator('#locationStartDate').count()
    .then(n => n > 0).catch(() => false);
  if (!onStep2) return 'navigate';

  // ── Address ──────────────────────────────────────────────────────────────
  const addrInput = page.locator(
    'input[placeholder*="Address" i], input[placeholder*="city" i], input[placeholder*="zip" i]'
  ).first();
  await addrInput.click({ clickCount: 3, timeout: 8000 }).catch(() => null);
  await addrInput.fill('Kerala').catch(() => null);
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); // dismiss any autocomplete

  // ── Dates (Kendo UI datepickers: id=locationStartDate / locationEndDate) ───
  const [y1, m1, d1] = dateWindow.start.split('-');
  const [y2, m2, d2] = dateWindow.end.split('-');
  const startFmt = `${m1}/${d1}/${y1}`;
  const endFmt   = `${m2}/${d2}/${y2}`;

  // Kendo UI datepickers require keyboard input (not .fill()) to trigger
  // internal state updates and enable the dependent end-date field.
  async function fillKendoDate(locator, value) {
    await locator.click();
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+a');
    await page.keyboard.type(value, { delay: 30 }); // e.g. "05/01/2026"
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);
  }

  // Prometric uses Kendo UI datepickers with ids locationStartDate / locationEndDate
  const startInput = page.locator('#locationStartDate').first();
  const endInput   = page.locator('#locationEndDate').first();

  if (await startInput.count() > 0) {
    await fillKendoDate(startInput, startFmt);

    // End date is disabled until start is filled — wait for Angular/Kendo to enable it
    await page.waitForFunction(
      () => !document.querySelector('#locationEndDate')?.disabled,
      { timeout: 5000 }
    ).catch(() => null);

    await page.waitForTimeout(300);

    // Check if end date is now enabled
    const endDisabled = await endInput.evaluate(el => el.disabled).catch(() => true);
    if (!endDisabled) {
      await fillKendoDate(endInput, endFmt);
    } else {
      // Still disabled — try force-filling via evaluate
      console.warn('    ⚠️   End date still disabled — using JS workaround');
      await endInput.evaluate((el, val) => {
        el.removeAttribute('disabled');
        el.removeAttribute('aria-disabled');
        el.value = val;
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, endFmt);
    }
  } else {
    // Fallback: use non-disabled combobox inputs (skip address = first one)
    const nonDisabled = page.locator('input[role="combobox"]:not([disabled]):visible, input[data-role="datepicker"]:not([disabled]):visible');
    const nCount = await nonDisabled.count();
    if (nCount >= 1) {
      await fillKendoDate(nonDisabled.nth(0), startFmt);
      await page.waitForTimeout(500);
      // Re-query after enabling
      const nonDisabled2 = page.locator('input[role="combobox"]:not([disabled]):visible, input[data-role="datepicker"]:not([disabled]):visible');
      if (await nonDisabled2.count() >= 2) {
        await fillKendoDate(nonDisabled2.nth(1), endFmt);
      }
    } else {
      console.warn('    ⚠️   Could not find any date inputs');
    }
  }

  await page.waitForTimeout(400);

  // Click Search / Next
  const searchBtn = page.locator('button, input[type="submit"]')
    .filter({ hasText: /^(next|search|find|go)$/i })
    .first();

  if (await searchBtn.count() > 0) {
    await searchBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(4000);

  // CAPTCHA after submission?
  if (!(await handleCaptcha(page, `search ${dateWindow.start}→${dateWindow.end}`))) return null;

  await page.waitForTimeout(1500);

  // ── Parse results ────────────────────────────────────────────────────────
  const bodyText = await page.textContent('body').catch(() => '');
  const result = { cochin: [], calicut: [] };

  for (const center of CENTERS) {
    if (!bodyText.includes(center.siteId)) continue;

    // Extract available dates from the section of the page near this center
    const dates = await page.evaluate((siteId) => {
      // Find the text node containing the site ID
      const allText = [...document.querySelectorAll('*')].filter(el =>
        el.children.length === 0 && el.textContent.includes(siteId)
      );
      if (!allText.length) return [];

      // Walk up to a meaningful container (row/section)
      let section = allText[0];
      for (let i = 0; i < 8; i++) {
        const p = section.parentElement;
        if (!p) break;
        const tag = p.tagName;
        if (['TR', 'LI', 'SECTION', 'ARTICLE', 'MAIN', 'TABLE', 'TBODY'].includes(tag)) break;
        section = p;
      }
      // Also grab the parent row/container
      const container = section.closest('tr, li, [class*="row"], [class*="result"], [class*="center"], [class*="location"]') || section;

      // Use the entire parent block to capture sibling date cells
      const scope = container.parentElement || container;
      const text = scope.textContent || '';

      // Match "May 5", "Jun 12", "June 3" etc.
      const named = [...text.matchAll(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?)\s+\d{1,2}/gi)];

      // Match MM/DD or MM/DD/YYYY
      const slashed = [...text.matchAll(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])(?:\/\d{2,4})?\b/g)];

      return [
        ...named.map(m => m[0].trim()),
        ...slashed.map(m => m[0].trim()),
      ];
    }, center.siteId);

    result[center.id] = dates;
  }

  return result;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍  CMA Prometric Scraper v2');
  console.log(`    Mode   : ${HEADLESS ? 'headless' : 'visible'}`);
  console.log(`    Range  : ${DATE_FROM} → ${DATE_TO}`);

  const windows = buildWindows();
  console.log(`    Windows: ${windows.length} (7-day each)`);
  console.log('');

  // Prefer system Chrome/Edge (already firewall-whitelisted) over bundled Chromium
  const launchOpts = {
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  };
  let browser;
  for (const channel of ['chrome', 'msedge', null]) {
    try {
      browser = await chromium.launch({ ...launchOpts, ...(channel ? { channel } : {}) });
      if (channel) console.log(`🌐  Using system browser: ${channel}`);
      break;
    } catch {
      // channel not installed — try next
    }
  }
  if (!browser) throw new Error('No usable browser found (Chrome, Edge, or Playwright Chromium)');

  const context = await buildContext(browser);
  const page    = await context.newPage();
  page.on('console', () => {}); // suppress page-level noise

  // collected[centerId][part] = Set of date strings
  const collected = {};
  for (const c of CENTERS) collected[c.id] = { '1': new Set(), '2': new Set() };

  let captchaBlocked = false;

  for (const examType of EXAM_TYPES) {
    if (captchaBlocked) break;
    console.log(`\n📋  ${examType.label}`);

    // Navigate through wizard step 1 (sponsor → program → exam → Next)
    const step1Ok = await navigateWizardStep1(page, examType.label);
    if (!step1Ok) {
      console.warn('    ⚠️   Wizard step 1 failed — skipping this exam type');
      continue;
    }

    for (const win of windows) {
      process.stdout.write(`  📅  ${win.start} → ${win.end}  `);

      let result = await searchAndParse(page, win);

      // If we ended up on the wrong page, re-navigate and retry once
      if (result === 'navigate') {
        console.log('(re-navigating wizard…)');
        const wizOk = await navigateWizardStep1(page, examType.label);
        if (!wizOk) { console.warn('    ⚠️   Re-navigation failed — skipping window'); continue; }
        await page.waitForSelector('#locationStartDate', { timeout: 10000 }).catch(() => null);
        process.stdout.write(`  📅  ${win.start} → ${win.end}  `);
        result = await searchAndParse(page, win);
      }

      if (result === null || result === 'navigate') {
        captchaBlocked = true;
        console.log('CAPTCHA blocked');
        break;
      }

      let summary = '';
      for (const center of CENTERS) {
        const dates = result[center.id];
        for (const d of dates) collected[center.id][examType.part].add(d);
        summary += `${center.id}:${dates.length} `;
      }
      console.log(summary.trim() || 'no results');

      // Polite delay between searches
      await page.waitForTimeout(1800 + Math.random() * 800);

      // If not the last window, go back to the search form for the next window
      if (win !== windows[windows.length - 1]) {
        let wentBack = false;
        // Try the Back button with a short timeout
        try {
          const backBtn = page.locator('button, a').filter({ hasText: /back|previous|modify/i }).first();
          if (await backBtn.count() > 0) {
            await backBtn.click({ timeout: 5000 });
            await page.waitForTimeout(1500);
            wentBack = true;
          }
        } catch { /* fall through */ }

        // Try browser back if button failed
        if (!wentBack) {
          try {
            await page.goBack({ timeout: 5000 });
            await page.waitForTimeout(1500);
            wentBack = true;
          } catch { /* fall through */ }
        }

        // Last resort: re-run wizard navigation
        if (!wentBack) {
          const wizOk = await navigateWizardStep1(page, examType.label);
          if (!wizOk) break;
        }
      }
    }
  }

  // Save cookies for next run
  const cookies = await context.cookies();
  writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
  console.log(`\n🍪  Session cookies saved → ${COOKIE_PATH}`);

  await browser.close();

  if (captchaBlocked) {
    console.log('\n⛔  Run aborted — CAPTCHA in headless mode.');
    console.log('    Fix: node scripts/scrape-prometric.js --headless=false');
    console.log('    Then commit the updated .prometric-session.json (or store as a GitHub Secret).');
    process.exit(1);
  }

  // Save captured API calls (--capture mode) so we can build a direct-API scraper
  if (CAPTURE && capturedRequests.length > 0) {
    writeFileSync(CAPTURE_PATH, JSON.stringify(capturedRequests, null, 2));
    console.log(`\n📡  Captured ${capturedRequests.length} Prometric API requests → ${CAPTURE_PATH}`);
    console.log('    Share this file so a direct-API (no-browser) scraper can be built.');
  }

  // ── Upsert to Supabase ─────────────────────────────────────────────────
  console.log('\n💾  Saving to database…');

  for (const center of CENTERS) {
    for (const part of ['1', '2']) {
      const dates  = [...collected[center.id][part]].sort();
      const status = dates.length > 0 ? 'available' : 'unavailable';
      const notes  = dates.length > 0
        ? `Slots ${DATE_FROM.slice(0, 7)}–${DATE_TO.slice(0, 7)}: ${dates.slice(0, 6).join(', ')}${dates.length > 6 ? ` +${dates.length - 6} more` : ''}`
        : `No slots ${DATE_FROM.slice(0, 7)}–${DATE_TO.slice(0, 7)}`;

      const { error } = await supabase.from('cma_availability').upsert({
        center_id:       center.id,
        exam_part:       part,
        status,
        available_seats: dates.length || null,
        scraped_at:      new Date().toISOString(),
        notes,
      }, { onConflict: 'center_id,exam_part' });

      const icon = status === 'available' ? '🟢' : '🔴';
      if (error) console.error(`  ❌  ${center.id} Part ${part}: ${error.message}`);
      else       console.log(`  ${icon}  ${center.id} Part ${part}: ${status} (${dates.length} date slots)`);
    }
  }

  console.log('\n🏁  Done');
}

main().catch(err => {
  console.error('💥  Fatal:', err.message);
  process.exit(1);
});
