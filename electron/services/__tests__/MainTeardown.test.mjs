import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainPath = path.resolve(__dirname, '../../main.ts');
const source = fs.readFileSync(mainPath, 'utf8');
const endMeetingStart = source.indexOf('public async endMeeting');
const endMeetingEnd = source.indexOf('private async processCompletedMeetingForRAG', endMeetingStart);
const endMeetingSource = source.slice(endMeetingStart, endMeetingEnd);

test('endMeeting always clears draining state after background teardown', () => {
  assert.ok(endMeetingStart >= 0, 'endMeeting should exist');
  assert.ok(endMeetingEnd > endMeetingStart, 'endMeeting source should be isolated');

  const finallyIndex = endMeetingSource.indexOf('} finally {');
  const clearIndex = endMeetingSource.indexOf('this._isDraining = false;', finallyIndex);

  assert.ok(finallyIndex >= 0, 'background teardown should have a finally block');
  assert.ok(clearIndex > finallyIndex, '_isDraining must be cleared inside finally');
});

test('endMeeting keeps draining enabled while awaiting both cloud transcript drains', () => {
  assert.match(endMeetingSource, /this\._isDraining = true;[\s\S]*await Promise\.all\(\[[\s\S]*this\.googleSTT\?\.drain\?\.\(2000\)[\s\S]*this\.googleSTT_User\?\.drain\?\.\(2000\)/);
});
