const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3100;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const INITIAL_STORE = {
  profiles: [],
  requests: [],
  threads: [],
  currentUserEmail: null,
};

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(INITIAL_STORE, null, 2));
  }
}

function readStore() {
  ensureStoreFile();
  const raw = fs.readFileSync(STORE_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeStore(store) {
  ensureStoreFile();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    return sendJson(res, 400, { error: 'Missing URL' });
  }

  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.url === '/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.url === '/store' && req.method === 'GET') {
    return sendJson(res, 200, { store: readStore() });
  }

  if (req.url === '/store' && req.method === 'PUT') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        writeStore(parsed.store ?? INITIAL_STORE);
        sendJson(res, 200, { ok: true });
      } catch (error) {
        sendJson(res, 400, { error: 'Invalid JSON payload' });
      }
    });

    return;
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  ensureStoreFile();
  console.log(`Velora backend listening on http://localhost:${PORT}`);
});
