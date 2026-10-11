import {execFileSync} from 'node:child_process';
import {mkdir, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'assets', 'hulan-logo.jpg');
const target = path.join(root, 'assets', 'mobile');
await mkdir(target, {recursive: true});
const ffmpeg = process.env.HULAN_FFMPEG || 'ffmpeg';
for (const [filename, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const contentSize = Math.floor(size * .78);
  const filter = `scale=${contentSize}:${contentSize}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=white`;
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-vf', filter, '-frames:v', '1', path.join(target, filename)], {windowsHide: true});
}
console.log(JSON.stringify({source: 'assets/hulan-logo.jpg', sha256: createHash('sha256').update(await readFile(source)).digest('hex'), sizes: [192, 512, 180], treatment: 'preserve aspect ratio and white padding'}));
