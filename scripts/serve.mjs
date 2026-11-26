#!/usr/bin/env node
/* 本地预览：node scripts/serve.mjs [端口]
   只是把当前目录起成一个静态服务，方便手机同网段打开、也方便以后加 service worker。
   应用本身仍然是零依赖、不联网的，这个脚本只在本机跑。
   文本资源按 Accept-Encoding 做 br / gzip，和托管方的默认行为对齐，本地量的首屏才有意义。
   createStaticServer() 也被 scripts/regression.mjs 复用，用来注入测试页面。 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';

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

/* 文本类资源按 Accept-Encoding 现压。托管方（GitHub Pages / Netlify / nginx）默认
   也会做同一件事，本地服务跟着做，是为了「本机量到的首屏时间」和线上是一个数量级——
   1.2.0 的 14.6s 弱网首开，有一半是本地服务不压缩造成的假象。
   小于 1KB 的不压：压缩头本身就有开销。 */
const COMPRESSIBLE = /^(?:text\/|application\/(?:json|javascript|manifest\+json)|image\/svg)/;
function encodeBody(req, type, body) {
  if (body.length < 1024 || !COMPRESSIBLE.test(type)) return { body, enc: '' };
  const ae = String(req.headers['accept-encoding'] || '');
  if (/\bbr\b/.test(ae)) return { body: brotliCompressSync(body), enc: 'br' };
  if (/\bgzip\b/.test(ae)) return { body: gzipSync(body), enc: 'gzip' };
  return { body, enc: '' };
}
function send(req, res, type, body) {
  const out = encodeBody(req, type, body);
  const headers = {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
    'Content-Length': out.body.length,
    Vary: 'Accept-Encoding'
  };
  if (out.enc) headers['Content-Encoding'] = out.enc;
  res.writeHead(200, headers).end(out.body);
}

/* extra 是内存里的虚拟文件表 { '/path': 内容 }，优先于磁盘；只给测试用。
   serveRoot 默认是仓库根目录；scripts/build.mjs 产出的 dist/ 要单独起服务时传进来。 */
export function createStaticServer(extra = {}, serveRoot = root) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (Object.prototype.hasOwnProperty.call(extra, rel)) {
        send(req, res, MIME[extname(rel)] || 'text/html; charset=utf-8', Buffer.from(extra[rel]));
        return;
      }
      if (rel.endsWith('/')) rel += 'index.html';
      const file = join(serveRoot, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
      if (!file.startsWith(serveRoot)) { res.writeHead(403).end('forbidden'); return; }
      const info = await stat(file);
      if (info.isDirectory()) { res.writeHead(302, { Location: rel + '/' }).end(); return; }
      const body = await readFile(file);
      send(req, res, MIME[extname(file)] || 'application/octet-stream', body);
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
