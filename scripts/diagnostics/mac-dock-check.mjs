import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
const [appPath, output, snapshotBinary] = process.argv.slice(2);
if (!appPath || !output || !snapshotBinary) throw new Error('Usage: mac-dock-check.mjs appPath outputDirectory snapshotBinary');
fs.mkdirSync(output, { recursive: true });
function run(command, args, optional = false) {
  try { return execFileSync(command, args, { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) { if (optional) return String(error.stderr || error.message); throw error; }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function snapshot(name) {
  const workspace = JSON.parse(run(snapshotBinary, []));
  let preferences = {};
  const xml = run('defaults', ['export', 'com.apple.dock', '-'], true);
  try {
    const raw = execFileSync('python3', ['-c', 'import sys,plistlib,json,datetime; print(json.dumps(plistlib.loads(sys.stdin.buffer.read()),default=lambda value: value.isoformat() if isinstance(value,datetime.datetime) else "<binary>"))'], { input: xml, encoding: 'utf8' });
    const data = JSON.parse(raw);
    for (const key of ['persistent-apps', 'recent-apps', 'persistent-others']) preferences[key] = (data[key] || []).filter(item => JSON.stringify(item).includes('AnswerCue') || JSON.stringify(item).includes('com.answercue'));
    preferences.showRecents = data['show-recents'];
  } catch { preferences.error = 'Dock preferences unavailable'; }
  const processes = run('ps', ['-axo', 'pid,ppid,comm']).split('\n').filter(line => line.includes('AnswerCue'));
  const result = { ...workspace, preferences, processes };
  fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(result, null, 2));
  run('screencapture', ['-x', path.join(output, `${name}.png`)], true);
  console.log(JSON.stringify({ phase: name, regularApps: workspace.applications.filter(app => app.activationPolicy === 0).length, apps: workspace.applications.map(app => ({ pid: app.pid, name: app.name, policy: app.activationPolicy, bundleId: app.bundleId })), dockItems: workspace.dockItems, recents: preferences['recent-apps'] }));
  return result;
}
const mainBundle = JSON.parse(run('plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Contents/Info.plist')]));
const helpers = fs.readdirSync(path.join(appPath, 'Contents/Frameworks')).filter(name => name.endsWith('.app')).map(name => {
  const plist = JSON.parse(run('plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Contents/Frameworks', name, 'Contents/Info.plist')]));
  return { name, id: plist.CFBundleIdentifier, displayName: plist.CFBundleDisplayName, bundleName: plist.CFBundleName, uiElement: plist.LSUIElement, backgroundOnly: plist.LSBackgroundOnly };
});
fs.writeFileSync(path.join(output, 'bundle-identity.json'), JSON.stringify({ version: mainBundle.CFBundleShortVersionString, bundleId: mainBundle.CFBundleIdentifier, helpers }, null, 2));
run('defaults', ['write', 'com.apple.dock', 'show-recents', '-bool', 'true']);
run('defaults', ['delete', 'com.apple.dock', 'recent-apps'], true);
run('killall', ['Dock'], true); await sleep(2000);
snapshot('00-before');
for (let cycle = 1; cycle <= 4; cycle++) {
  run('open', [appPath]); await sleep(3000); run(snapshotBinary, ['--dismiss-permissions'], true); await sleep(3000);
  snapshot(`${cycle}-launch`);
  for (let repeat = 0; repeat < 3; repeat++) { const message = run('open', [appPath], true); if (message) fs.appendFileSync(path.join(output, 'reopen-messages.log'), message); await sleep(700); }
  const active = snapshot(`${cycle}-reopen`);
  const parents = active.applications.filter(app => app.bundleId === 'com.answercue.desktop');
  for (const app of parents) run('kill', ['-TERM', String(app.pid)], true);
  await sleep(3000);
  const stopped = snapshot(`${cycle}-quit`);
  // Remove only test processes if normal termination left a windowless helper.
  for (const app of stopped.applications) run('kill', ['-KILL', String(app.pid)], true);
}
// Also exercise direct executable launches, as users can launch from Terminal.
const executable = path.join(appPath, 'Contents/MacOS/AnswerCue');
const log = fs.openSync(path.join(output, 'direct-launch.log'), 'w');
const child = spawn(executable, ['--remote-debugging-port=9222', '--remote-debugging-address=127.0.0.1'], { stdio: ['ignore', log, log] });
await sleep(3000); run(snapshotBinary, ['--dismiss-permissions'], true); await sleep(3000); snapshot('direct-launch');
let debugSocket;
try {
  const pages = await (await fetch('http://127.0.0.1:9222/json/list', { signal: AbortSignal.timeout(5000) })).json();
  const page = pages.find(page => page.url.includes('window=launcher')) || pages.find(page => page.type === 'page');
  if (!page) throw new Error('No renderer debug target');
  const socket = new WebSocket(page.webSocketDebuggerUrl); debugSocket = socket;
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Debug socket setup timed out')), 5000); socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true }); socket.addEventListener('error', error => { clearTimeout(timer); reject(error); }, { once: true }); });
  let id = 0;
  const evaluate = expression => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { socket.removeEventListener('message', listener); reject(new Error('Debug command timed out')); }, 10000);
    const listener = event => { const response = JSON.parse(event.data); if (response.id !== requestId) return; clearTimeout(timer); socket.removeEventListener('message', listener); response.error || response.result?.exceptionDetails ? reject(new Error(JSON.stringify(response))) : resolve(response.result); };
    socket.addEventListener('message', listener);
    socket.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  for (let toggle = 1; toggle <= 4; toggle++) {
    await evaluate('window.electronAPI.setUndetectable(true)'); await sleep(1500); snapshot(`stealth-${toggle}-hide`);
    await evaluate('window.electronAPI.setUndetectable(false)'); await sleep(1800); snapshot(`stealth-${toggle}-show`);
  }
  socket.close();
} catch (error) { fs.writeFileSync(path.join(output, 'debug-toggle-error.log'), error.stack); }
finally { debugSocket?.close(); }
child.kill('SIGTERM'); await sleep(3000); const final = snapshot('direct-quit');
for (const application of final.applications) run('kill', ['-KILL', String(application.pid)], true);
child.kill('SIGKILL'); child.unref(); fs.closeSync(log);
console.log(`Dock diagnostic evidence: ${output}`);
process.exit(0);
