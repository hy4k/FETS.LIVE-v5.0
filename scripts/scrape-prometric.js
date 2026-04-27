#!/usr/bin/env node
/**
 * CMA Prometric Seat Availability Scraper
 *
 * Navigates Prometric's scheduling portal to check CMA exam seat availability
 * and upserts results into the `cma_availability` Supabase table.
 *
 * Prerequisites:
 *   npm install playwright @supabase/supabase-js dotenv
 *   npx playwright install chromium
 *
 * Usage:
 *   node scripts/scrape-prometric.js
 *   node scripts/scrape-prometric.js --headless=false   # debug: shows browser
 *   node scripts/scrape-prometric.js --center=cochin    # single center
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../fets-point/.env') });
dotenvConfig({ path: resolve(__dirname, '../.env') });

// ── Configuration ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE key. Check your .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CENTERS = [
  { id: 'cochin',  city: 'Kochi',     state: 'Kerala', country: 'IND' },
  { id: 'calicut', city: 'Kozhikode', state: 'Kerala', country: 'IND' },
];

const EXAM_PARTS = ['1', '2'];

// Prometric ProScheduler search URL for ICMA (CMA) exams
const PROMETRIC_URL = 'https://proscheduler.prometric.com/';
const EXAM_SPONSOR = 'ICMA'; // sponsor code for CMA

// ── Argument Parsing ───────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const headless = args.headless !== 'false';
const singleCenter = args.center;

const centersToScrape = singleCenter
  ? CENTERS.filter(c => c.id === singleCenter)
  : CENTERS;

if (centersToScrape.length === 0) {
  console.error(`❌ Unknown center: ${singleCenter}. Valid: ${CENTERS.map(c => c.id).join(', ')}`);
  process.exit(1);
}

// ── Browser Context ────────────────────────────────────────────────────────

async function createStealthContext(browser) {
  const context = await browser.newContext({
    // Match a real Windows Chrome fingerprint
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  // Remove webdriver flag that Cloudflare detects
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });

  return context;
}

// ── Scraping Logic ─────────────────────────────────────────────────────────

async function scrapeCenter(page, center, examPart) {
  console.log(`  ↳ Scraping ${center.id} Part ${examPart}…`);

  try {
    // Step 1: Load the ProScheduler page (use domcontentloaded — never use networkidle
    // on Cloudflare-protected sites, it never fires due to beacon/analytics requests)
    await page.goto(PROMETRIC_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Wait for actual page content, not just the HTML shell
    await page.waitForTimeout(3000);

    // Step 2: Check if Cloudflare challenge page loaded instead of the real page
    const title = await page.title();
    const bodyText = (await page.textContent('body').catch(() => '')).toLowerCase();

    if (title.toLowerCase().includes('just a moment') || bodyText.includes('checking your browser')) {
      console.warn(`  ⚠️  Cloudflare challenge detected for ${center.id} Part ${examPart}. Waiting 8s…`);
      await page.waitForTimeout(8000);
    }

    // Step 3: Look for the exam sponsor selector / search form
    // ProScheduler flow: Select sponsor → select exam → enter location → see dates
    const sponsorInput = page.locator([
      'input[placeholder*="sponsor" i]',
      'input[placeholder*="exam" i]',
      '[data-testid="sponsor-search"]',
      '#sponsor-search',
      '.sponsor-input',
    ].join(', ')).first();

    if (await sponsorInput.count() > 0) {
      await sponsorInput.click();
      await sponsorInput.fill(EXAM_SPONSOR);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Step 4: Enter location / city
    const locationInput = page.locator([
      'input[placeholder*="city" i]',
      'input[placeholder*="location" i]',
      'input[placeholder*="zip" i]',
      '#location-input',
    ].join(', ')).first();

    if (await locationInput.count() > 0) {
      await locationInput.click();
      await locationInput.fill(center.city);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    // Step 5: Parse availability from the results
    const result = await page.evaluate(({ city, part }) => {
      // Generic selectors — update these after inspecting the live ProScheduler DOM
      const containers = document.querySelectorAll(
        '.test-center, .location-card, .site-result, [class*="center"], [class*="location"]'
      );

      for (const el of containers) {
        const text = (el.textContent || '').toLowerCase();
        if (!text.includes(city.toLowerCase())) continue;

        // Look for seat count patterns like "3 seats", "Available", "Full"
        const seatMatch = text.match(/(\d+)\s*seat/i);
        const seats = seatMatch ? parseInt(seatMatch[1], 10) : null;

        const isFull = /full|sold out|no.*avail|unavail/i.test(text);
        const isLimited = /limited|few/i.test(text) || (seats !== null && seats <= 5);
        const isAvailable = /available|\d+.*seat/i.test(text) && !isFull;

        let status = 'unknown';
        if (isFull) status = 'unavailable';
        else if (isLimited) status = 'limited';
        else if (isAvailable) status = 'available';

        return { found: true, seats, status };
      }

      // If no center found but page loaded (no error), treat as unknown
      const pageLoaded = document.body.children.length > 2;
      return { found: false, pageLoaded };
    }, { city: center.city, part: examPart });

    let status = 'unknown';
    let availableSeats = null;

    if (result.found) {
      status = result.status;
      availableSeats = result.seats;
    }

    return { status, available_seats: availableSeats };

  } catch (err) {
    const msg = err.message?.split('\n')[0] || err.message;
    console.warn(`  ⚠️  ${center.id} Part ${examPart}: ${msg}`);
    return { status: 'unknown', available_seats: null, error: msg };
  }
}

// ── Database ───────────────────────────────────────────────────────────────

async function upsertRecord({ centerId, examPart, status, availableSeats, notes }) {
  const { error } = await supabase.from('cma_availability').upsert(
    {
      center_id: centerId,
      exam_part: examPart,
      status,
      available_seats: availableSeats,
      scraped_at: new Date().toISOString(),
      notes: notes || null,
    },
    { onConflict: 'center_id,exam_part' }
  );

  if (error) {
    console.error(`  ❌ DB upsert failed for ${centerId} Part ${examPart}:`, error.message);
  } else {
    const icon = status === 'available' ? '🟢' : status === 'limited' ? '🟡' : status === 'unavailable' ? '🔴' : '⚪';
    console.log(`  ${icon} Saved: ${centerId} Part ${examPart} → ${status}${availableSeats != null ? ` (${availableSeats} seats)` : ''}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 CMA Prometric Scraper starting…');
  console.log(`   Centers : ${centersToScrape.map(c => c.id).join(', ')}`);
  console.log(`   Headless: ${headless}`);
  console.log('');

  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // hides headless flag
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  const context = await createStealthContext(browser);
  const page = await context.newPage();
  page.on('console', () => {}); // suppress page console noise

  let totalUpdated = 0;
  let totalErrors = 0;

  for (const center of centersToScrape) {
    console.log(`\n📍 ${center.id} — ${center.city}, ${center.state}`);

    for (const part of EXAM_PARTS) {
      const result = await scrapeCenter(page, center, part);

      await upsertRecord({
        centerId: center.id,
        examPart: part,
        status: result.status,
        availableSeats: result.available_seats,
        notes: result.error ? `Scrape error: ${result.error}` : null,
      });

      if (result.error) totalErrors++;
      else totalUpdated++;

      // Polite delay — looks more human, avoids rate limiting
      await page.waitForTimeout(2000 + Math.random() * 1000);
    }
  }

  await browser.close();

  console.log(`\n🏁 Done — ${totalUpdated} rows updated, ${totalErrors} scrape errors`);

  if (totalErrors === centersToScrape.length * EXAM_PARTS.length) {
    console.log('\n⚠️  All requests failed. Prometric may be blocking this IP.');
    console.log('   Options:');
    console.log('   1. Run locally with --headless=false to debug');
    console.log('   2. Update PROMETRIC_URL in this file if the portal URL changed');
    console.log('   3. Use a manual update form in the app (see README)\n');
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
