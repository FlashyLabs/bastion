// The network edge. This is the only file in src/ that touches a socket, a
// clock, a key or the filesystem; everything it does with a request is
// delegated to the pure handler in handler.mjs.
//
//   node src/server.mjs examples/operator.config.json
//
// PORT (default 8787) and HOST (default 127.0.0.1) come from the environment.

import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertConfig } from './config.mjs';
import { handle } from './handler.mjs';
import { WELL_KNOWN_PATH } from './agent-doc.mjs';

export const MAX_BODY_BYTES = 64 * 1024;

/**
 * The deps v0 injects into the handler.
 *
 * `receiptSigner` is an UNKEYED sha256 digest and is labelled as one in the
 * receipt (`alg: "sha256-digest-unsigned"`). It proves a receipt's bytes have
 * not changed since it was rendered; it proves nothing about who rendered it.
 * A keyed signature with a published verification key is designed and not
 * built — see ARCHITECTURE.md, stage 5. Do not read this digest as a signature.
 */
export function defaultDeps() {
  return {
    now: () => new Date().toISOString(),
    receiptSigner: (payload) => ({
      alg: 'sha256-digest-unsigned',
      value: createHash('sha256').update(payload).digest('hex'),
    }),
  };
}

export async function loadConfig(path) {
  const text = await readFile(path, 'utf8');
  return assertConfig(JSON.parse(text));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('body too large'), { code: 'body_too_large' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined));
    req.on('error', reject);
  });
}

/**
 * createServer(config, deps) → node:http.Server (not yet listening)
 */
export function createServer(config, deps = defaultDeps()) {
  assertConfig(config);
  return http.createServer(async (req, res) => {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      if (error.code === 'body_too_large') {
        res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' });
        res.end(`${JSON.stringify({ error: 'body_too_large', limit: MAX_BODY_BYTES })}\n`);
        return;
      }
      res.writeHead(400);
      res.end();
      return;
    }
    const response = handle({ method: req.method, path: req.url, headers: req.headers, body }, config, deps);
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  });
}

/**
 * listen(server, { port, host }) → Promise<{ port, host, close() }>
 * Port 0 asks the OS for a free port; the resolved value says which.
 */
export function listen(server, { port = 0, host = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        port: address.port,
        host: address.address,
        close: () => new Promise((done, fail) => server.close((error) => (error ? fail(error) : done()))),
      });
    });
  });
}

async function main(argv) {
  const configPath = argv[2];
  if (!configPath) {
    process.stderr.write('usage: node src/server.mjs <operator.config.json>\n');
    return 2;
  }
  let config;
  try {
    config = await loadConfig(configPath);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
  const server = createServer(config);
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '127.0.0.1';
  const bound = await listen(server, { port, host });
  process.stdout.write(`bastion v0 skeleton for ${config.org}\n`);
  process.stdout.write(`  http://${bound.host}:${bound.port}${WELL_KNOWN_PATH}\n`);
  process.stdout.write(`  edge declared as ${config.edge} — this process is a local stand-in, not that host\n`);
  return null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv).then((code) => {
    if (code !== null) process.exit(code);
  });
}
