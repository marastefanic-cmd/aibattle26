#!/usr/bin/env node
// Builds index.html (the installable GitHub Pages copy) from app.html (the page
// body that is also published as the Claude artifact), and writes version.json
// from the VERSION in data.js. Run after every change: node warhammer/build.js
'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const data = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const m = data.match(/const VERSION = '([^']+)'/);
if (!m) throw new Error('VERSION not found in data.js');
const version = m[1];

const body = fs.readFileSync(path.join(dir, 'app.html'), 'utf8')
  // cache-bust the data file per version so a fresh page never pairs with stale data
  .replace('<script src="data.js"></script>', `<script src="data.js?v=${version}"></script>`);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:0}[hidden]{display:none!important}img{max-width:100%}</style>
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(dir, 'index.html'), html);
fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version }) + '\n');

// the service worker carries the version too, so the browser sees a new worker
const swPath = path.join(dir, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
fs.writeFileSync(swPath, sw);
console.log('built', version);
