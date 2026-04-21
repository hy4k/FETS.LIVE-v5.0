/**
 * Playwright sketch: two isolated browser contexts (Cochin then Calicut),
 * each login → extract → one POST to paragon-schedule-sync (ingest).
 *
 * Run from this directory:
 *   pnpm install && pnpm run install:browsers
 *   cp .env.example .env   # fill secrets locally; never commit .env
 *   pnpm start
 */

import { chromium } from 'playwright'
import { loadEnv } from './lib/env.mjs'
import { loginToPortal } from './lib/login.mjs'
import { extractBookingsForCentre } from './lib/extractSchedule.mjs'
import { postIngest } from './lib/ingestClient.mjs'

const env = loadEnv()

const centres = [
  {
    key: 'cochin',
    email: env.cochinEmail,
    password: env.cochinPassword,
  },
  {
    key: 'calicut',
    email: env.calicutEmail,
    password: env.calicutPassword,
  },
]

const browser = await chromium.launch({ headless: env.headless })

try {
  for (const centre of centres) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    })
    const page = await context.newPage()

    try {
      await loginToPortal(page, {
        portalUrl: env.paragonPortalUrl,
        email: centre.email,
        password: centre.password,
      })

      const bookings = await extractBookingsForCentre(page, {
        portalUrl: env.paragonPortalUrl,
        centreKey: centre.key,
        startMonth: env.startMonth,
        endMonth: env.endMonth,
      })

      const result = await postIngest({
        supabaseFunctionUrl: env.supabaseFunctionUrl,
        supabaseAnonKey: env.supabaseAnonKey,
        paragonSyncSecret: env.paragonSyncSecret,
        startMonth: env.startMonth,
        endMonth: env.endMonth,
        location: centre.key,
        bookings,
      })

      console.log(
        JSON.stringify(
          {
            centre: centre.key,
            bookingsPosted: bookings.length,
            syncOk: result?.ok,
            syncDetails: result?.sync_details ?? result?.error,
          },
          null,
          2,
        ),
      )
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
