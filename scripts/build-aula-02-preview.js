const fs = require('fs');
const path = require('path');

// 1. Read the template CSS and structure from aula-01-preview.html
const a1Html = fs.readFileSync('c:/plataforna de estudo/plataformadeestudo/public/preview/aula-01-preview.html', 'utf-8');

// Extract CSS from aula-01
const styleStart = a1Html.indexOf('<style>');
const styleEnd = a1Html.indexOf('</style>');
const styleCss = a1Html.slice(styleStart, styleEnd + 8);

// Read aula-02 raw content from prev-efa2424552e7/apostila.html
const a2Raw = fs.readFileSync('c:/plataforna de estudo/plataformadeestudo/.apostilas-work/preview/sanitize-only/prev-efa2424552e7/apostila.html', 'utf-8');

// Sections of Aula 02
const sections = [
  { id: 's01', n: '01', title: 'Noções iniciais de Classes de Palavras I', page: 3 },
  { id: 's02', n: '02', title: 'Classes variáveis e invariáveis', page: 4 },
  { id: 's03', n: '03', title: 'Substantivo', page: 5 },
  { id: 's04', n: '04', title: 'Adjetivo', page: 18 },
  { id: 's05', n: '05', title: 'Expressões com Substantivo e Adjetivo', page: 27 },
  { id: 's06', n: '06', title: 'Advérbio', page: 35 },
  { id: 's07', n: '07', title: 'Artigo', page: 45 },
  { id: 's08', n: '08', title: 'Numeral', page: 49 },
  { id: 's09', n: '09', title: 'Interjeição', page: 51 },
  { id: 's10', n: '10', title: 'Palavras especiais', page: 53 },
  { id: 's11', n: '11', title: 'Noções iniciais de pronomes', page: 59 },
  { id: 's12', n: '12', title: 'Pronomes', page: 60 },
  { id: 's13', n: '13', title: 'Colocação Pronominal', page: 84 },
  { id: 's14', n: '14', title: 'Resumo — Classes de palavras I', page: 93 },
  { id: 's15', n: '15', title: 'Questões Comentadas — Classes de palavras (AOCP)', page: 102 },
  { id: 's16', n: '16', title: 'Lista de Questões — Classes de palavras (AOCP)', page: 119 },
  { id: 's17', n: '17', title: 'Questões Comentadas — Pronomes', page: 130 },
  { id: 's18', n: '18', title: 'Lista de Questões — Pronomes', page: 158 },
];

console.log('Sections to generate:', sections.length);
