import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
// A new build gets a new public-shell cache and service-worker version.
const html = await readFile('dist/index.html', 'utf8');
const version = createHash('sha256').update(html).digest('hex').slice(0, 12);
const worker = await readFile('public/sw.js', 'utf8');
await writeFile('dist/sw.js', worker.replace('ras-shell-v2', `ras-shell-${version}`));
