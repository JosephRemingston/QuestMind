import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
async function walk(dir) { const result = []; for (const entry of await readdir(dir, { withFileTypes: true })) { if (['node_modules', 'coverage', 'tmp', 'output'].includes(entry.name)) continue; const path = `${dir}/${entry.name}`; if (entry.isDirectory()) result.push(...await walk(path)); else if (path.endsWith('.js')) result.push(path); } return result; }
const files = await walk('.');
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`Syntax checked ${files.length} JavaScript files`);
