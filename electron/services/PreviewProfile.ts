// This side-effect import MUST execute before storage modules compute their paths.
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

// Integration previews never migrate or overwrite the stable AnswerCue profile.
if (app.getVersion().includes('-upstream.')) {
  const previewProfilePath = path.join(app.getPath('appData'), 'AnswerCue-UpstreamPreview');
  fs.mkdirSync(previewProfilePath, { recursive: true });
  app.setPath('userData', previewProfilePath);
}

