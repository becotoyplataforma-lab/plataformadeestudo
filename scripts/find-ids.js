const fs = require('fs');

const a1Html = fs.readFileSync('c:/plataforna de estudo/plataformadeestudo/public/preview/aula-01-preview.html', 'utf-8');

const idRegex = /id="([^"]+)"/g;
let m;
const ids = new Set();
while ((m = idRegex.exec(a1Html)) !== null) {
  if (m[1].startsWith('s')) ids.add(m[1]);
}
console.log('IDs starting with s in aula-01-preview:', [...ids]);
