import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureGolden } from '../test/helpers/golden.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', 'test', 'fixtures');
const outPath = join(fixturesDir, 'golden-v1.json');
const ncubeOutPath = join(fixturesDir, 'golden-ncube-v1.json');
const NCUBE_VARIANTS = ['ncube', 'ncube-4'];

mkdirSync(fixturesDir, { recursive: true });
const golden = await captureGolden();
writeFileSync(outPath, JSON.stringify(golden, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.log(`static entries: ${Object.keys(golden.static).length}`);
console.log(`mounted entries: ${Object.keys(golden.mounted).length}`);

const ncubeGolden = {};
for (const variant of NCUBE_VARIANTS) {
  ncubeGolden[variant] = await captureGolden({ variant });
}
writeFileSync(ncubeOutPath, JSON.stringify(ncubeGolden, null, 2) + '\n');
console.log(`Wrote ${ncubeOutPath}`);
for (const variant of NCUBE_VARIANTS) {
  console.log(`${variant}: static ${Object.keys(ncubeGolden[variant].static).length}, mounted ${Object.keys(ncubeGolden[variant].mounted).length}`);
}
