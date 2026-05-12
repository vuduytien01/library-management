const fs = require('fs');
const vi = JSON.parse(fs.readFileSync('src/i18n/locales/vi.json', 'utf8'));

function checkKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = /t\([\x22\x27]([^\x22\x27]+)[\x22\x27]/g;
  let match;
  console.log('Missing in ' + filePath + ':');
  while ((match = regex.exec(content)) !== null) {
    const keyPath = match[1];
    const keys = keyPath.split('.');
    let current = vi;
    let found = true;
    for (const key of keys) {
      if (current[key] === undefined) {
        found = false;
        break;
      }
      current = current[key];
    }
    if (!found) console.log(' - ' + keyPath);
  }
}

checkKeys('app/(member)/profile.tsx');
checkKeys('app/(member)/audiobooks/index.tsx');
checkKeys('app/(member)/audiobooks/[id].tsx');
