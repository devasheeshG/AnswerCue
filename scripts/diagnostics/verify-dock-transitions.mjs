import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
const [app, output, snapshot] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const log = fs.openSync(path.join(output, 'dock-probe.log'), 'w');
const child = spawn(path.join(app, 'Contents/MacOS/AnswerCue'), [], { env: { ...process.env, ANSWERCUE_DOCK_PROBE_DIR: output }, stdio: ['ignore', log, log] });
let exited = false, exitCode = null;
child.on('exit', code => { exited = true; exitCode = code; });
let sequence = 0; const states = [];
const deadline = Date.now() + 60000;
try {
  while (!exited && Date.now() < deadline) {
    const markerPath = path.join(output, 'phase.json');
    if (fs.existsSync(markerPath)) {
      let marker;
      try { marker = JSON.parse(fs.readFileSync(markerPath, 'utf8')); } catch { await new Promise(resolve => setTimeout(resolve, 100)); continue; }
      if (marker.sequence !== sequence) {
        sequence = marker.sequence;
        // Give Dock time to reflect the native activation-policy transition.
        await new Promise(resolve => setTimeout(resolve, 600));
        const data = JSON.parse(execFileSync(snapshot, [], { encoding: 'utf8', timeout: 10000 }));
        states.push({ ...marker, entries: data.dockItems.length });
        fs.writeFileSync(path.join(output, `${marker.sequence}-${marker.phase}.json`), JSON.stringify(data, null, 2));
        execFileSync('screencapture', ['-x', path.join(output, `${marker.sequence}-${marker.phase}.png`)], { timeout: 10000 });
        console.log(JSON.stringify(states.at(-1)));
        assert(data.dockItems.length <= 1, `Duplicate Dock entries after ${marker.phase}`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(exited, 'Dock probe timed out'); assert.equal(exitCode, 0);
  assert(states.some(state => state.phase.startsWith('hide-')), 'No hide transition captured');
  assert(states.some(state => state.phase.startsWith('show-')), 'No show transition captured');
  console.log('[verify-dock-transitions] PASS: at most one Dock item across live hide/show transitions');
} finally { if (!exited) child.kill('SIGKILL'); child.unref(); fs.closeSync(log); }
