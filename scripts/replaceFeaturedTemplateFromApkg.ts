import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const [, , sourcePathArg, destinationPathArg] = process.argv;

  if (!sourcePathArg || !destinationPathArg) {
    throw new Error('Usage: vite-node scripts/replaceFeaturedTemplateFromApkg.ts <source.apkg> <destination.json>');
  }

  const sourcePath = path.resolve(sourcePathArg);
  const destinationPath = path.resolve(destinationPathArg);
  const fileBuffer = await readFile(sourcePath);
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  ) as ArrayBuffer;

  (globalThis as { window?: object }).window = {};
  const { parseAnkiPackage } = await import('@/lib/ankiImport');
  const { rows } = await parseAnkiPackage(path.basename(sourcePath), arrayBuffer);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, JSON.stringify(rows));

  const deckNames = [...new Set(rows.map((row) => row.deck.trim()).filter(Boolean))];
  console.log(JSON.stringify({
    sourcePath,
    destinationPath,
    rowCount: rows.length,
    deckNames,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
