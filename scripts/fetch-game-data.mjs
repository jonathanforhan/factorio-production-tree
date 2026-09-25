#!/usr/bin/env node
// Vendors the FactorioLab "spa" (Factorio + Space Age + Elevated Rails + Quality) dataset
// into public/data/factorio-spa/. This gives us a normalized items/recipes/machines/modules/
// beacons/qualities dataset without having to write our own `factorio --dump-data` parser.
//
// Source: https://github.com/factoriolab/factoriolab (MIT-licensed tooling; the underlying
// Factorio game data/names are Wube Software's IP). Re-run with `npm run data:update` to pull
// a fresh copy when a new Factorio version ships.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'factoriolab/factoriolab';
const DATASET = 'spa';
const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'data',
  'factorio-spa',
);

async function getMasterSha() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/branches/master`, {
    headers: { 'User-Agent': 'factorio-production-tree-data-fetch' },
  });
  if (!res.ok) throw new Error(`Failed to resolve master sha: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.commit.sha;
}

async function downloadFile(sha, repoPath, outPath) {
  const url = `https://raw.githubusercontent.com/${REPO}/${sha}/${repoPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
  return buf;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('Resolving latest factoriolab/factoriolab master commit...');
  const sha = await getMasterSha();
  console.log(`Using commit ${sha}`);

  console.log('Downloading data.json...');
  const dataBuf = await downloadFile(
    sha,
    `public/data/${DATASET}/data.json`,
    path.join(OUT_DIR, 'data.json'),
  );

  console.log('Downloading icons.webp...');
  await downloadFile(
    sha,
    `public/data/${DATASET}/icons.webp`,
    path.join(OUT_DIR, 'icons.webp'),
  );

  const data = JSON.parse(dataBuf.toString('utf-8'));
  const factorioVersion = data.version?.base ?? 'unknown';

  const source = `# Data source

Vendored from [factoriolab/factoriolab](https://github.com/${REPO}) (MIT-licensed tooling),
dataset \`${DATASET}\` (Factorio + Space Age + Elevated Rails + Quality).

- Source commit: https://github.com/${REPO}/tree/${sha}
- Fetched: ${new Date().toISOString()}
- Factorio version: ${factorioVersion}
- Items: ${data.items?.length ?? '?'}, Recipes: ${data.recipes?.length ?? '?'}

Factorio's game data, names, and artwork are the intellectual property of Wube Software.
This dataset is used here for a non-commercial, fan-made production calculator, following the
same community norm long used by other Factorio calculators (e.g. Kirk McDonald's calculator and
FactorioLab itself). This project is not affiliated with or endorsed by Wube Software.

Re-run \`npm run data:update\` to pull a fresh copy.
`;
  await writeFile(path.join(OUT_DIR, 'SOURCE.md'), source);

  console.log(`Done. Factorio version ${factorioVersion}, ${data.items.length} items, ${data.recipes.length} recipes.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
