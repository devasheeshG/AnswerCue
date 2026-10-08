import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { MacDockVisibility } from './MacDockVisibility';

/** Isolated packaged Dock test: no audio capture, stored keys, or network. */
export async function runPackagedDockProbe(directory: string): Promise<void> {
  fs.mkdirSync(directory, { recursive: true });
  const window = new BrowserWindow({ width: 400, height: 200, title: 'AnswerCue Dock test', webPreferences: { sandbox: true, contextIsolation: true } });
  await window.loadURL('data:text/html,<title>AnswerCue Dock test</title><p>Mac Dock lifecycle test</p>');
  const visibility = new MacDockVisibility(app.dock);
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  let sequence = 0;
  const marker = (phase: string) => fs.writeFileSync(path.join(directory, 'phase.json'), JSON.stringify({ sequence: ++sequence, phase, pid: process.pid, visible: app.dock.isVisible() }));
  marker('initial'); await pause(1500);
  for (let cycle = 1; cycle <= 4; cycle++) {
    await visibility.setVisible(false); marker(`hide-${cycle}`); await pause(1500);
    await visibility.setVisible(true); marker(`show-${cycle}`); await pause(1800);
  }
  // Repeated requests while visible must retain one registration.
  await Promise.all([visibility.setVisible(true), visibility.setVisible(true), visibility.setVisible(true)]);
  marker('repeated-show'); await pause(1500);
  visibility.dispose(); window.destroy(); marker('finished');
}
