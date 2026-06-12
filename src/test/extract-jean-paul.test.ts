import { describe, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseAnkiPackage } from '../lib/ankiImport';

describe('Extract Jean Paul', () => {
  it.skip('should extract apkg to json', async () => {
    const apkgPath = path.resolve('C:\\Users\\psjoh\\Downloads\\Jean Paul.apkg');
    if (!fs.existsSync(apkgPath)) {
      console.warn('Skipping extract-jean-paul.test.ts because local apkg is not present.');
      return;
    }
    const buffer = fs.readFileSync(apkgPath).buffer;
    
    // We need to provide a filename and buffer
    const parsed = await parseAnkiPackage('Jean Paul.apkg', buffer);
    
    // Write back to public/learn-templates/jean-paul.json
    const outputPath = path.resolve('public/learn-templates/jean-paul.json');
    fs.writeFileSync(outputPath, JSON.stringify(parsed));
    
    console.log(`Successfully extracted ${parsed.rows.length} rows to ${outputPath}`);
  }, { timeout: 30000 });
});
