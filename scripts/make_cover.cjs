/** Original 3:2 key art composed from the game's authored SVGs and witnesses.
 * Usage: node scripts/make_cover.cjs [absolute path to the sharp module]
 * Uses the frontend's existing React/TypeScript tooling; no generated imagery.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const projectRequire = createRequire(path.join(root, 'frontend/package.json'));
const sharp = require(process.argv[2] || 'sharp');
const ts = projectRequire('typescript');
const React = projectRequire('react');
const { renderToStaticMarkup } = projectRequire('react-dom/server');
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'frontend/src/components/WitnessAvatar.tsx'), 'utf8'),
  { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
const avatarModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(projectRequire, avatarModule, avatarModule.exports);
const { WitnessCutout: WitnessAvatar } = avatarModule.exports;
const campus = fs.readFileSync(path.join(root, 'frontend/public/art/campus-night.svg'), 'utf8')
  .replace('<svg ', '<svg x="0" y="70" width="2400" height="1500" ');
const witnesses = [[1010, 1140, 0, 'none', -7], [1335, 1090, 1, 'beanie', 3], [1650, 1130, 2, 'cap', -3], [1960, 1100, 4, 'headphones', 6]]
  .map(([x, y, color, hat, angle]) => `<g transform="translate(${x} ${y}) rotate(${angle} 160 200)">${renderToStaticMarkup(React.createElement(WitnessAvatar, { color, hat }))
    .replace('<svg ', '<svg width="350" height="450" ' )}</g>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600" viewBox="0 0 2400 1600">
  <defs>
    <linearGradient id="coverShade"><stop stop-color="#101d27" stop-opacity=".96"/><stop offset=".48" stop-color="#101d27" stop-opacity=".4"/><stop offset="1" stop-color="#101d27" stop-opacity="0"/></linearGradient>
    <linearGradient id="coverFoot" x2="0" y2="1"><stop stop-color="#101d27" stop-opacity="0"/><stop offset="1" stop-color="#101d27"/></linearGradient>
  </defs>
  <rect width="2400" height="1600" fill="#101d27"/>
  ${campus}
  <rect width="2400" height="1600" fill="url(#coverShade)"/>
  <rect y="1080" width="2400" height="520" fill="url(#coverFoot)"/>
  <path d="M55 65H2335V1535H65V65" fill="none" stroke="#b2ceba" stroke-opacity=".32" stroke-width="3"/>
  <path d="M65 65H230M65 65V230M2170 1535H2335V1370" fill="none" stroke="#ef805f" stroke-width="12"/>
  <g transform="rotate(-5 710 470)">
    <text x="143" y="533" fill="#ef805f" font-family="Impact, Arial Narrow, sans-serif" font-size="330" font-weight="900" letter-spacing="-4">I SWEAR!</text>
    <text x="130" y="520" fill="#f2e4c8" font-family="Impact, Arial Narrow, sans-serif" font-size="330" font-weight="900" letter-spacing="-4">I SWEAR!</text>
  </g>
  <path d="M139 649 853 596" stroke="#ef805f" stroke-width="13"/>
  <text x="140" y="760" fill="#f2e4c8" font-family="Impact, Arial Narrow, sans-serif" font-size="91" font-weight="900">SAME EVENT.</text>
  <text x="140" y="865" fill="#ecc574" font-family="Impact, Arial Narrow, sans-serif" font-size="91" font-weight="900">DIFFERENT MEMORIES.</text>
  <text x="140" y="969" fill="#b2ceba" font-family="Arial, sans-serif" font-size="34">You were all there.</text>
  <text x="140" y="1017" fill="#b2ceba" font-family="Arial, sans-serif" font-size="34">Someone remembers it wrong.</text>
  <g transform="translate(1890 124) rotate(5)">
    <path d="M0 0H326V155L295 179H0Z" fill="#f2e4c8"/>
    <text x="28" y="62" fill="#101d27" font-family="Impact, Arial Narrow, sans-serif" font-weight="900" font-size="49">WHO DO YOU</text>
    <text x="28" y="119" fill="#101d27" font-family="Impact, Arial Narrow, sans-serif" font-weight="900" font-size="49">BELIEVE?</text>
    <circle cx="290" cy="21" r="9" fill="#ef805f"/>
  </g>
  <path d="M967 1550Q1500 1250 2370 1535" fill="#0c1921"/>
  ${witnesses}
  <g transform="translate(133 1220) rotate(-4)">
    <path d="M0 0H685V187H0Z" fill="#f2e4c8"/>
    <path d="M0 0H16V187H0Z" fill="#ef805f"/>
    <text x="41" y="51" fill="#405665" font-family="monospace" font-size="22" letter-spacing="3">A SOCIAL MYSTERY ABOUT MEMORY</text>
    <text x="41" y="122" fill="#101d27" font-family="Impact, Arial Narrow, sans-serif" font-size="60" font-weight="900">TRUST THE RECORDS.</text>
    <path d="M42 145H640" stroke="#101d27" stroke-width="2"/>
  </g>
  <text x="142" y="1480" fill="#b2ceba" font-family="monospace" font-size="25" letter-spacing="3">4–8 WITNESSES · THREE INCIDENTS</text>
</svg>`;
fs.writeFileSync(path.join(root, 'artifacts/i-swear-cover.svg'), svg);
sharp(Buffer.from(svg)).resize(1200, 800).jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
  .toFile(path.join(root, 'artifacts/submission-cover.jpg')).then(info => {
    fs.copyFileSync(path.join(root, 'artifacts/submission-cover.jpg'), path.join(root, 'frontend/public/art/i-swear-cover.jpg'));
    console.log(JSON.stringify(info));
  });
