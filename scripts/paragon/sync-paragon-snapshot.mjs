import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const repoRoot = path.resolve(__dirname, '..', '..')
const src = path.join(repoRoot, 'fets-point', 'src', 'data', 'paragon-bookings-snapshot.json')
const dst = path.join(repoRoot, 'supabase', 'functions', '_shared', 'paragon-bookings-snapshot.json')

fs.copyFileSync(src, dst)
// eslint-disable-next-line no-console
console.log(`Synced Paragon snapshot:\n  ${src}\n-> ${dst}`)
