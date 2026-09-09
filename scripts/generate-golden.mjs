import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureGolden } from '../test/helpers/golden.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outPath = join(__dirname, '..', 'test', 'fixtures', 'golden-v1.json');

mkdirSync(dirname(outPath), { recursive: true });
const golden = await captureGolden();
writeFileSync(outPath, JSON.stringify(golden, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
console.log(`static entries: ${Object.keys(golden.static).length}`);
console.log(`mounted entries: ${Object.keys(golden.mounted).length}`);
