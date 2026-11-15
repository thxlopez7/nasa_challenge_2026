import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LEGACY_ROOT_CONTRACT = path.join(ROOT, 'telemetry.ts');
const CANONICAL_CONTRACT = path.join(ROOT, 'types', 'telemetry.ts');

if (fs.existsSync(LEGACY_ROOT_CONTRACT)) {
  console.error(
    'ERROR: Duplicate root file telemetry.ts must stay deleted; types/telemetry.ts is the sole canonical contract.'
  );
  process.exit(1);
}

if (!fs.existsSync(CANONICAL_CONTRACT)) {
  console.error('ERROR: Canonical contract types/telemetry.ts is missing.');
  process.exit(1);
}

const TARGET_DIRS = ['app', 'components', 'config', 'hooks', 'i18n', 'store', 'utils'];
const DUPLICATE_DECL_RE = /^\s*export\s+(?:interface|type)\s+(?:TelemetryState|ClinicalAlerts|Biomarkers)\b/m;

const duplicates = [];

function scanDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      if (DUPLICATE_DECL_RE.test(content)) {
        duplicates.push(path.relative(ROOT, full));
      }
    }
  }
}

for (const dir of TARGET_DIRS) {
  scanDir(path.join(ROOT, dir));
}

if (duplicates.length > 0) {
  console.error(
    `ERROR: Duplicate telemetry contract declarations found outside types/telemetry.ts: ${duplicates.join(', ')}`
  );
  process.exit(1);
}

console.log('OK: Canonical contract check passed (only types/telemetry.ts exists; root telemetry.ts removed).');
