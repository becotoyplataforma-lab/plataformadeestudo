const fs = require('fs');

const a2Raw = fs.readFileSync('c:/plataforna de estudo/plataformadeestudo/.apostilas-work/preview/sanitize-only/prev-efa2424552e7/apostila.html', 'utf-8');

const regex = /<h2\s+id="([^"]+)"[^>]*>(.*?)<\/h2>/g;
let m;
const found = [];
while ((m = regex.exec(a2Raw)) !== null) {
  found.push({ id: m[1], title: m[2].replace(/<[^>]+>/g, '').trim() });
}
console.log('Found h2 tags:', found.length);
console.log(found.slice(0, 10));
