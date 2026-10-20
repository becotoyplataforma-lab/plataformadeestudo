const fs = require('fs');
const html = fs.readFileSync('c:/plataforna de estudo/plataformadeestudo/public/preview/aula-01-preview.html', 'utf-8');

console.log('Total length:', html.length);
const secRegex = /<section\s+id="([^"]+)"/g;
let m;
const sections = [];
while ((m = secRegex.exec(html)) !== null) {
  sections.push(m[1]);
}
console.log('Sections found:', sections.length, sections);

const navStart = html.indexOf('<nav class="sidebar-toc"');
const navEnd = html.indexOf('</nav>', navStart);
if (navStart !== -1) {
  console.log('Sidebar nav snippet:\n', html.slice(navStart, Math.min(navStart + 1200, navEnd + 10)));
}
