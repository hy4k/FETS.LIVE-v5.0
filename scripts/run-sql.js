#!/usr/bin/env node
const DEFAULT_REF = 'qqewusetilxxfvfkmsed';

function parseArgs(argv) {
  const out = { projectRef: DEFAULT_REF, raw: false, query: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--raw') out.raw = true;
    else if (a.startsWith('--project-ref=')) out.projectRef = a.split('=')[1];
    else if (a === '--project-ref' && i + 1 < argv.length) { out.projectRef = argv[++i]; }
    else if (a === '--query' && i + 1 < argv.length) { out.query = argv[++i]; }
    else if (a.startsWith('--query=')) out.query = a.split('=').slice(1).join('=');
    else if (!out.query) out.query = a;
    else out.query += ' ' + a;
  }
  return out;
}

async function main() {
  const { projectRef, raw, query } = parseArgs(process.argv);
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN is not set');
    process.exit(1);
  }
  if (!query || !query.trim()) {
    console.error('Usage: node scripts/run-sql.js [--project-ref <ref>] [--raw] --query "select 1;"');
    process.exit(1);
  }
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': token,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error(`Request failed: ${resp.status} ${resp.statusText}${text ? ' - ' + text : ''}`);
    process.exit(1);
  }
  const data = await resp.json();
  if (raw) {
    console.log(JSON.stringify(data));
  } else {
    console.log(JSON.stringify(data.value ?? data));
  }
}

main().catch(err => {
  console.error(err?.message || String(err));
  process.exit(1);
});

