#!/usr/bin/env node
/* 本地预览：node scripts/serve.mjs [端口]
   只是把当前目录起成一个静态服务，方便手机同网段打开、也方便以后加 service worker。
   应用本身仍然是零依赖、不联网的，这个脚本只在本机跑。
   createStaticServer() 也被 scripts/regression.mjs 复用，用来注入测试页面。 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
};

/* extra 是内存里的虚拟文件表 { '/path': 内容 }，优先于磁盘；只给测试用。 */
export function createStaticServer(extra = {}) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (Object.prototype.hasOwnProperty.call(extra, rel)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }).end(extra[rel]);
        return;
      }
      if (rel.endsWith('/')) rel += 'index.html';
      const file = join(root, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
      if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
      const info = await stat(file);
      if (info.isDirectory()) { res.writeHead(302, { Location: rel + '/' }).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      }).end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found');
    }
  });
}

/* 只有被直接执行时才监听端口；被 import 时不启动服务。 */
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.argv[2] || 5173);
  createStaticServer().listen(port, () => {
    console.log(`心情闯关岛 → http://localhost:${port}`);
  });
}
