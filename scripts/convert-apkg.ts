import * as fs from 'fs';
import * as path from 'path';
import { parseAnkiPackage } from '../src/lib/ankiImport.ts';

async function main() {
  const apkgPath = path.resolve('C:\\Users\\psjoh\\Downloads\\Jean Paul.apkg');
  const buffer = fs.readFileSync(apkgPath).buffer;
  
  // We need to provide a filename and buffer
  const parsed = await parseAnkiPackage('Jean Paul.apkg', buffer);
  
  // Write back to public/learn-templates/jean-paul.json
  const outputPath = path.resolve('public/learn-templates/jean-paul.json');
  fs.writeFileSync(outputPath, JSON.stringify(parsed));
  
  console.log(`Successfully extracted ${parsed.rows.length} rows to ${outputPath}`);
}

main().catch(console.error);
