const fs = require('fs');
const path = require('path');
function writeNotices(modulePaths, destination) {
  const roots = new Set();
  for (const file of modulePaths) {
    const normalized = path.resolve(file.split('?')[0]).replaceAll('\\', '/');
    const match = normalized.match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)(?:\/|$)/);
    if (match) roots.add(match[1]);
  }
  const sections = [];
  for (const root of [...roots].sort()) {
    const manifest = path.join(root, 'package.json');
    if (!fs.existsSync(manifest)) continue;
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    let body = `${pkg.name} ${pkg.version}\nLicense: ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license || 'See upstream package')}\n`;
    for (const file of fs.readdirSync(root)) {
      if (/^(licen[sc]e|copying|notice)([._-].*)?$/i.test(file) && fs.statSync(path.join(root, file)).isFile()) body += '\n' + fs.readFileSync(path.join(root, file), 'utf8');
    }
    sections.push(body);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, 'Third-party software notices\n\n' + sections.join('\n\n------------------------------------------------------------\n\n'));
}
module.exports = { writeNotices };
