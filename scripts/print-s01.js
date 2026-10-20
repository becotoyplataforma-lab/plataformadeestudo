const fs = require('fs');

const a1Html = fs.readFileSync('c:/plataforna de estudo/plataformadeestudo/public/preview/aula-01-preview.html', 'utf-8');

const s01Idx = a1Html.indexOf('id="s01"');
console.log(a1Html.slice(s01Idx - 100, s01Idx + 500));
