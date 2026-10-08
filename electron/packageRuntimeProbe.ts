import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { ingestMarkdownDocument } from './services/InterviewContextDocsManager';
import { loadNativeModule } from './audio/nativeModuleLoader';
import { CloudTranscriptionSTT } from './audio/CloudTranscriptionSTT';

function pdf(text: string): Buffer {
  const content = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let output = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}
function crc32(bytes: Buffer): number {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}
function docx(): Buffer {
  const files = { '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>PACKAGEDDOCXCONTEXT</w:t></w:r></w:p></w:body></w:document>' };
  const chunks: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const filename = Buffer.from(name), body = Buffer.from(text), checksum = crc32(body);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(checksum, 14); header.writeUInt32LE(body.length, 18); header.writeUInt32LE(body.length, 22); header.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt32LE(checksum, 16); directory.writeUInt32LE(body.length, 20); directory.writeUInt32LE(body.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    chunks.push(header, filename, body); central.push(directory, filename); offset += header.length + filename.length + body.length;
  }
  const directories = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(3, 8); end.writeUInt16LE(3, 10); end.writeUInt32LE(directories.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directories, end]);
}
/** CI diagnostic: no windows, key reads, recording, or network calls. */
export async function verifyPackagedRuntime(directory: string): Promise<void> {
  assert(app.isPackaged, 'Run the runtime probe against a packaged app');
  app.setPath('userData', directory);
  const db = new Database(':memory:'); assert.equal((db.prepare('SELECT 1 AS value').get() as any).value, 1); db.close();
  const keytar = require('keytar'); assert.equal(typeof keytar.getPassword, 'function');
  const native = loadNativeModule(); assert(native, 'Packaged native audio module did not load');
  const image = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#0088ff' } }).resize(2, 2).png().toBuffer(); assert(image.length > 0);
  const fixtures: Array<[string, Buffer, string]> = [['context.pdf', pdf('PACKAGED_PDF_CONTEXT'), 'PACKAGED_PDF_CONTEXT'], ['context.docx', docx(), 'PACKAGEDDOCXCONTEXT'], ['context.txt', Buffer.from('PACKAGED_TEXT_CONTEXT'), 'PACKAGED_TEXT_CONTEXT']];
  for (const [name, bytes, expected] of fixtures) {
    const file = path.join(directory, name); fs.writeFileSync(file, bytes);
    const parsed = await ingestMarkdownDocument(file); assert(parsed.markdown.includes(expected), `${name} import failed`);
  }
  for (const model of ['gpt-live-transcribe', 'scribe_v2_realtime']) {
    const stt = new CloudTranscriptionSTT('unused-probe-key', model); stt.stop();
  }
  console.log(`[package-runtime-probe] PASS ${process.arch}: native database, keytar, audio addon, image conversion, PDF/DOCX/TXT extraction, transcription modules`);
}
