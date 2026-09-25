import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { convert } from './convert.mjs';
import { ROOT, ghostscriptPath, browserAvailable } from './runtime.mjs';
import { getProfile } from './profiles.mjs';

const PORT = 47831;
const MAX_BODY = 145 * 1024 * 1024;
const IDLE_MS = 10 * 60 * 1000;
const TOKEN_PATH = join(ROOT, '.runtime', 'converter-token');
const ALLOWED_ORIGINS = new Set(['null', 'https://www.figma.com', 'https://figma.com']);

async function persistentToken() {
  await mkdir(join(ROOT, '.runtime'), { recursive: true });

  try {
    const value = (await readFile(TOKEN_PATH, 'utf8')).trim();
    if (value.length >= 32) return value;
  } catch {
    // create below
  }

  const value = randomBytes(24).toString('hex');
  await writeFile(TOKEN_PATH, `${value}\n`, { mode: 0o600 });
  return value;
}

function authorized(req, token) {
  const auth = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  return auth.length === expected.length && timingSafeEqual(auth, expected);
}

export function createConverterServer({ token, convertFile = convert } = {}) {
  let active = false;
  let idleTimer = null;

  const touch = () => {
    if (idleTimer) clearTimeout(idleTimer);

    idleTimer = setTimeout(() => {
      if (active) {
        touch();
        return;
      }

      console.log('\n10 минут бездействия. Конвертер выключается.\n');
      server.close(() => process.exit(0));
    }, IDLE_MS);

    idleTimer.unref?.();
  };

  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      res.writeHead(403);
      return res.end();
    }

    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }

    const allowedHosts = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
    if (!allowedHosts.has(req.headers.host || '')) {
      res.writeHead(403);
      return res.end();
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };

    if (req.method === 'GET' && req.url === '/pair') {
      touch();
      return json(200, { version: 3, token });
    }

    if (!authorized(req, token)) {
      return json(401, { error: 'Неверный код подключения.' });
    }

    touch();

    if (req.method === 'GET' && req.url === '/health') {
      const [gs, browser, profile] = await Promise.all([
        ghostscriptPath().then(() => true, () => false),
        browserAvailable(),
        getProfile().then(value => value.name, () => null),
      ]);

      return json(200, {
        version: 3,
        ghostscript: gs,
        browser,
        profile,
      });
    }

    if (req.method !== 'POST' || req.url !== '/convert') {
      return json(404, { error: 'Неизвестный запрос.' });
    }

    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
      return json(415, { error: 'Ожидается JSON.' });
    }

    if (active) return json(409, { error: 'Конвертер занят.' });

    if (Number(req.headers['content-length']) > MAX_BODY) {
      return json(413, { error: 'Файл слишком большой.' });
    }

    active = true;

    try {
      let size = 0;
      const chunks = [];

      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) {
          json(413, { error: 'Файл слишком большой.' });
          req.resume();
          return;
        }
        chunks.push(chunk);
      }

      let data;
      try {
        data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return json(400, { error: 'Некорректный JSON.' });
      }

      const result = await convertFile(data);
      touch();

      return json(200, {
        base64: result.bytes.toString('base64'),
        profile: result.profile,
      });
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Ошибка конвертации.';
      if (error?.cmd || error?.killed) {
        message = 'Не удалось преобразовать PDF. Проверьте ICC-профиль.';
      }
      return json(422, { error: message.slice(0, 500) });
    } finally {
      active = false;
      touch();
    }
  });

  server.requestTimeout = 180000;
  server.headersTimeout = 10000;

  return { server, touch };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = await persistentToken();
  const { server, touch } = createConverterServer({ token });

  server.on('error', error => {
    if (error.code === 'EADDRINUSE') process.exit(0);
    console.error(error.message);
    process.exitCode = 1;
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Layer Export Converter: http://127.0.0.1:${PORT}`);
    console.log('Автовыключение после 10 минут простоя.');
    touch();
  });
}
