#!/usr/bin/env node
/**
 * CMA Prometric Seat Availability Scraper
 *
 * Scrapes the Prometric scheduling portal for CMA exam seat availability
 * and upserts results into the `cma_availability` Supabase table.
 *
 * Prerequisites:
 *   npm install playwright @supabase/supabase-js dotenv
 *   npx playwright install chromium
 *
 * Usage:
 *   node scripts/scrape-prometric.js
 *   node scripts/scrape-prometric.js --headless=false   # debug mode
 *   node scripts/scrape-prometric.js --center=cochin    # single center
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../fets-point/.env') });
dotenvConfig({ path: resolve(__dirname, '../.env') }); // fallback

// ── Configuration ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE key. Check your .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Prometric test center codes for CMA India centers.
// Update these codes from: https://www.prometric.com/test-takers/search/icma
const CENTERS = [
  { id: 'cochin',      prometricCode: 'CKOCHI',   city: 'Kochi',              state: 'Kerala' },
  { id: 'calicut',     prometricCode: 'CKOZHI',   city: 'Kozhikode',          state: 'Kerala' },
  { id: 'trivandrum',  prometricCode: 'CTRIVN',   city: 'Thiruvananthapuram', state: 'Kerala' },
  { id: 'bangalore',   prometricCode: 'CBANG',    city: 'Bengaluru',          state: 'Karnataka' },
  { id: 'chennai',     prometricCode: 'CCHENN',   city: 'Chennai',            state: 'Tamil Nadu' },
];

const EXAM_PARTS = ['1', '2'];

// Prometric scheduling portal base URL (adjust if portal URL changes)
const PROMETRIC_BASE = 'https://www.prometric.com/test-takers/search/icma';

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

// ── Scraping Logic ─────────────────────────────────────────────────────────

async function scrapeCenter(page, center, examPart) {
  console.log(`  ↳ Scraping ${center.id} — Part ${examPart}…`);

  try {
    // Navigate to the Prometric availability search page
    await page.goto(PROMETRIC_BASE, { waitUntil: 'networkidle', timeout: 30000 });

    // -- Step 1: Select exam part / program --
    // These selectors are illustrative; update them after inspecting the live portal.
    const examPartSelector = `[data-testid="exam-part-${examPart}"], input[value*="Part ${examPart}"]`;
    if (await page.locator(examPartSelector).count() > 0) {
      await page.locator(examPartSelector).first().click();
    }

    // -- Step 2: Enter test center / location --
    const locationInput = page.locator('input[placeholder*="location"], input[placeholder*="city"], #location-search');
    if (await locationInput.count() > 0) {
      await locationInput.first().fill(center.city);
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    }

    // -- Step 3: Look for availability indicators --
    // Prometric typically shows seat counts or colored availability badges.
    // Update these selectors to match the actual portal markup.
    const availabilityData = await page.evaluate((centerId) => {
      const rows = Array.from(document.querySelectorAll('[data-center-id], .test-center-row, .location-result'));
      for (const row of rows) {
        const text = row.textContent || '';
        if (text.toLowerCase().includes(centerId)) {
          const seatText = row.querySelector('.seat-count, [data-seats], .availability-count')?.textContent?.trim();
          const statusEl = row.querySelector('.status-badge, .availability-badge, [data-status]');
          const status = statusEl?.dataset?.status || statusEl?.textContent?.trim().toLowerCase() || '';
          const seats = seatText ? parseInt(seatText, 10) : null;
          return { found: true, seats, status };
        }
      }
      return { found: false };
    }, center.city.toLowerCase());

    // Determine normalized status
    let status = 'unknown';
    let availableSeats = null;

    if (availabilityData.found) {
      const rawStatus = availabilityData.status || '';
      if (rawStatus.includes('available') || (availabilityData.seats && availabilityData.seats > 5)) {
        status = 'available';
      } else if (rawStatus.includes('limited') || (availabilityData.seats && availabilityData.seats <= 5)) {
        status = 'limited';
      } else if (rawStatus.includes('full') || rawStatus.includes('unavailable') || availabilityData.seats === 0) {
        status = 'unavailable';
      }
      availableSeats = availabilityData.seats;
    }

    return { status, available_seats: availableSeats };
  } catch (err) {
    console.warn(`  ⚠️  Error scraping ${center.id} Part ${examPart}: ${err.message}`);
    return { status: 'unknown', available_seats: null, error: err.message };
  }
}

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
    console.log(`  ✅ Saved: ${centerId} Part ${examPart} → ${status} (seats: ${availableSeats ?? 'unknown'})`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 CMA Prometric Scraper starting…');
  console.log(`   Centers: ${centersToScrape.map(c => c.id).join(', ')}`);
  console.log(`   Headless: ${headless}`);
  console.log('');

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  // Suppress non-essential console output from the scraped page
  page.on('console', () => {});

  let totalProcessed = 0;
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

      if (result.status === 'unknown' && result.error) totalErrors++;
      else totalProcessed++;

      // Polite delay between requests
      await page.waitForTimeout(1500);
    }
  }

  await browser.close();

  console.log(`\n🏁 Done — ${totalProcessed} records updated, ${totalErrors} errors`);

  if (totalErrors > 0) {
    console.log('\n💡 If selectors failed, open the scraper in debug mode:');
    console.log('   node scripts/scrape-prometric.js --headless=false');
    console.log('   Then inspect the Prometric portal and update the selectors in this file.\n');
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
