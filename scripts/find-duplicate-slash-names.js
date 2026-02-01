const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'src', 'slashCommands');

function walk(dir) {
  let files = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) files = files.concat(walk(p));
    else if (/\.js$/.test(name)) files.push(p);
  }
  return files;
}

const files = walk(root);
const nameCounts = {};
const occurrences = {};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const head = content.split(/\r?\n/).slice(0, 30).join('\n');
  // Look for top-level name: 'xxx' OR builder .setName('xxx') within first 30 lines
  let m = head.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
  if (!m) m = head.match(/\.setName\(['"`]([^'"`]+)['"`]\)/);
  if (m) {
    const n = m[1];
    nameCounts[n] = (nameCounts[n] || 0) + 1;
    occurrences[n] = occurrences[n] || [];
    occurrences[n].push(path.relative(process.cwd(), file));
  }
}

const duplicates = Object.keys(nameCounts).filter(k => nameCounts[k] > 1).sort();
if (duplicates.length === 0) {
  console.log('No duplicate top-level command names found.');
} else {
  console.log('Duplicate top-level command names:');
  for (const d of duplicates) {
    console.log(d + ' -> ' + occurrences[d].join(', '));
  }
}
