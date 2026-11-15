import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

function loadTsModule(relPath) {
  const fullPath = path.join(ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: fullPath,
  });

  const mod = { exports: {} };
  const fn = new vm.Script(`(function(exports, require, module, __filename, __dirname) {\n${outputText}\n})`, {
    filename: fullPath,
  }).runInThisContext();

  const localRequire = (specifier) => {
    if (specifier.startsWith('.')) {
      const resolved = path.resolve(path.dirname(fullPath), specifier);
      const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`];
      const match = candidates.find((c) => fs.existsSync(c));
      if (match) return loadTsModule(path.relative(ROOT, match));
    }
    return require(specifier);
  };

  fn(mod.exports, localRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

const errors = [];

function compareTrees(esVal, enVal, prefix) {
  const esIsObj = esVal !== null && typeof esVal === 'object' && !Array.isArray(esVal);
  const enIsObj = enVal !== null && typeof enVal === 'object' && !Array.isArray(enVal);

  if (esIsObj && enIsObj) {
    const esKeys = Object.keys(esVal).sort();
    const enKeys = Object.keys(enVal).sort();
    for (const k of esKeys) {
      if (!Object.prototype.hasOwnProperty.call(enVal, k)) {
        errors.push(`Missing EN key for ${prefix}.${k}`);
      }
    }
    for (const k of enKeys) {
      if (!Object.prototype.hasOwnProperty.call(esVal, k)) {
        errors.push(`Extra EN key not in ES: ${prefix}.${k}`);
      }
    }
    for (const k of esKeys) {
      if (Object.prototype.hasOwnProperty.call(enVal, k)) {
        compareTrees(esVal[k], enVal[k], `${prefix}.${k}`);
      }
    }
    return;
  }

  if (typeof esVal !== typeof enVal) {
    errors.push(`Type mismatch at ${prefix}: ES is ${typeof esVal}, EN is ${typeof enVal}`);
    return;
  }

  if (typeof esVal === 'string') {
    if (esVal.trim().length === 0) errors.push(`Empty ES string at ${prefix}`);
    if (typeof enVal === 'string' && enVal.trim().length === 0) {
      errors.push(`Empty EN string at ${prefix}`);
    }
  }
}

// 1. Dictionary parity: i18n/es.ts vs i18n/en.ts
const { es } = loadTsModule('i18n/es.ts');
const { en } = loadTsModule('i18n/en.ts');
compareTrees(es, en, 'dict');

// 2. Indicator guides parity: content/indicators.es.ts vs content/indicators.en.ts
const { INDICATORS_ES } = loadTsModule('content/indicators.es.ts');
const { INDICATORS_EN } = loadTsModule('content/indicators.en.ts');
compareTrees(INDICATORS_ES, INDICATORS_EN, 'indicators');

// 3. Scan allowed UI files for inline `lang === 'es' ? '...' : '...'` ternaries
const COMPONENT_ROOTS = [
  'components/CommandDashboard.tsx',
  'components/GodModePanel.tsx',
  'components/MedicalCopilot.tsx',
  'components/OutboxPanel.tsx',
  'components/RuleTrace.tsx',
  'components/RulesAndLimitationsSection.tsx',
  'components/SbarReportModal.tsx',
  'components/command',
  'components/mission',
];

const MULTILINE_LANG_TERNARY = /\b(?:lang|locale)\s*[!=]==?\s*['"](?:es|en)['"]\s*\?\s*['"`]/g;

function collectFiles(entry) {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  const out = [];
  for (const child of fs.readdirSync(full, { withFileTypes: true })) {
    const childRel = path.join(entry, child.name);
    if (child.isDirectory()) out.push(...collectFiles(childRel));
    else if (child.name.endsWith('.tsx') || child.name.endsWith('.ts')) {
      out.push(path.join(ROOT, childRel));
    }
  }
  return out;
}

const filesToScan = COMPONENT_ROOTS.flatMap(collectFiles);
for (const absPath of filesToScan) {
  const rel = path.relative(ROOT, absPath);
  const content = fs.readFileSync(absPath, 'utf8');
  let m;
  MULTILINE_LANG_TERNARY.lastIndex = 0;
  while ((m = MULTILINE_LANG_TERNARY.exec(content)) !== null) {
    const before = content.slice(0, m.index);
    const lineNum = before.split('\n').length;
    const snippet = content.slice(m.index, m.index + 80).replace(/\s+/g, ' ').trim();
    errors.push(`Inline language string ternary found in ${rel}:${lineNum} -> ${snippet}`);
  }
}

if (errors.length > 0) {
  console.error('ERROR: i18n check failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log(
  `OK: i18n parity & hygiene passed (${Object.keys(es).length} top-level namespaces, ${Object.keys(INDICATORS_ES).length} indicator guides, ${filesToScan.length} components scanned).`
);
