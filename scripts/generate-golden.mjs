import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureGolden, fixtureFor } from '../test/helpers/golden.js';
import { BUILT_IN_VARIANTS, DEFAULT_VARIANT_ID } from '../src/variants/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'test', 'fixtures');

const summarize = (golden) => `static ${Object.keys(golden.static).length}, mounted ${Object.keys(golden.mounted).length}`;

mkdirSync(fixturesDir, { recursive: true });

// The default variant keeps its historical un-keyed fixture shape.
const defaultOutPath = join(fixturesDir, fixtureFor(DEFAULT_VARIANT_ID));
const golden = await captureGolden();
writeFileSync(defaultOutPath, JSON.stringify(golden, null, 2) + '\n');
console.log(`Wrote ${defaultOutPath}`);
console.log(`${DEFAULT_VARIANT_ID}: ${summarize(golden)}`);

// Every other registered id is grouped by family file, one entry per id in registry order.
const families = new Map();
for (const id of BUILT_IN_VARIANTS.ids.filter((id) => id !== DEFAULT_VARIANT_ID)) {
  const file = fixtureFor(id);
  if (!families.has(file)) families.set(file, {});
  families.get(file)[id] = await captureGolden({ variant: id });
}

for (const [file, entries] of families) {
  const outPath = join(fixturesDir, file);
  writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n');
  console.log(`Wrote ${outPath}`);
  for (const [id, entry] of Object.entries(entries)) console.log(`${id}: ${summarize(entry)}`);
}
