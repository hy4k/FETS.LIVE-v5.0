import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.join(__dirname, '..')
dotenv.config({ path: path.join(packageRoot, '.env') })

function req(name) {
  const v = process.env[name]
  if (!v || String(v).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return String(v).trim()
}

export function loadEnv() {
  return {
    paragonPortalUrl: req('PARAGON_PORTAL_URL'),
    cochinEmail: req('PARAGON_COCHIN_EMAIL'),
    cochinPassword: req('PARAGON_COCHIN_PASSWORD'),
    calicutEmail: req('PARAGON_CALICUT_EMAIL'),
    calicutPassword: req('PARAGON_CALICUT_PASSWORD'),
    supabaseFunctionUrl: req('SUPABASE_FUNCTION_URL'),
    supabaseAnonKey: req('SUPABASE_ANON_KEY'),
    paragonSyncSecret: req('PARAGON_SYNC_SECRET'),
    startMonth: process.env.PARAGON_START_MONTH?.trim() || '2026-04',
    endMonth: process.env.PARAGON_END_MONTH?.trim() || '2026-06',
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
  }
}
