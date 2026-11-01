// Inline engine.js and ai.js into ui.html -> dist/tarokk.html (single file, no build step needed to run)
const fs = require('fs');
let html = fs.readFileSync(__dirname + '/ui.html', 'utf8');
const eng = fs.readFileSync(__dirname + '/engine.js', 'utf8'), ai = fs.readFileSync(__dirname + '/ai.js', 'utf8');
html = html.replace('<script>/*ENGINE*/</script>', () => '<script>\n' + eng + '\n</script>').replace('<script>/*AI*/</script>', () => '<script>\n' + ai + '\n</script>');
// Mitz & Simz card art: every art/*.svg becomes a data: URI in window.MS_ART
const artDir = __dirname + '/art';
const art = {};
if (fs.existsSync(artDir)) for (const f of fs.readdirSync(artDir)) if (/^(back|T\d+|[HDCS][KQCJX])\.svg$/.test(f))
  art[f.replace('.svg', '')] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fs.readFileSync(artDir + '/' + f, 'utf8').replace(/\s+/g, ' ').trim());
html = html.replace('<script>/*ART*/</script>', () => '<script>window.MS_ART = ' + JSON.stringify(art) + ';</script>');
console.log('art cards:', Object.keys(art).join(' ') || 'none');
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/tarokk.html', html);
fs.writeFileSync(__dirname + '/index.html', html); // GitHub Pages serves this
console.log('built', html.length, 'bytes');
