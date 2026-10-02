// Joins supabase/migrations/*.sql into supabase/setup_all.sql with every comment removed.
// The Supabase dashboard's "Run and enable RLS" step rewrites the query and breaks a leading
// "--" comment, so the pasteable file is pure SQL. Run: npm run build:sql
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase');
const files = readdirSync(join(dir, 'migrations')).filter((f) => f.endsWith('.sql')).sort();

const clean = files
  .map((f) => readFileSync(join(dir, 'migrations', f), 'utf8'))
  .join('\n')
  .split(/\r?\n/)
  .map((line) => line.replace(/\s*--.*$/, '').trimEnd())
  .filter((line) => line !== '')
  .join('\n');

if (/'[^']*--[^']*'/.test(clean)) throw new Error('A string literal contains "--"; stripping comments is unsafe.');
writeFileSync(join(dir, 'setup_all.sql'), clean + '\n');
console.log(`wrote supabase/setup_all.sql from ${files.length} migrations (${clean.split('\n').length} lines)`);
