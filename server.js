/**
 * Local Disk Storage Server for LHP-Dev-Tracker
 * Automatically saves all tasks & ticket updates directly to tasks.json on your hard drive.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const TASKS_FILE = path.join(__dirname, 'tasks.json');
const KPIS_FILE = path.join(__dirname, 'kpi_data.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // API Endpoint: Get Tasks from disk
  if (url.pathname === '/api/tasks' && req.method === 'GET') {
    fs.readFile(TASKS_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read tasks file' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // API Endpoint: Save Tasks to disk
  if (url.pathname === '/api/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload must be an array of tasks' }));
          return;
        }

        fs.writeFile(TASKS_FILE, JSON.stringify(parsed, null, 2), 'utf8', (err) => {
          if (err) {
            console.error('Error writing to tasks.json:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save to hard drive' }));
            return;
          }
          console.log(`[${new Date().toLocaleTimeString()}] Saved ${parsed.length} tasks to tasks.json on hard drive`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, savedCount: parsed.length }));
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // API Endpoint: Get KPIs from disk
  if (url.pathname === '/api/kpis' && req.method === 'GET') {
    fs.readFile(KPIS_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read kpi_data.json' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // API Endpoint: Save KPIs to disk
  if (url.pathname === '/api/kpis' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!Array.isArray(parsed)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload must be an array of KPI entries' }));
          return;
        }

        fs.writeFile(KPIS_FILE, JSON.stringify(parsed, null, 2), 'utf8', (err) => {
          if (err) {
            console.error('Error writing to kpi_data.json:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save KPIs to disk' }));
            return;
          }
          console.log(`[${new Date().toLocaleTimeString()}] Saved ${parsed.length} KPI entries to kpi_data.json on hard drive`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, savedCount: parsed.length }));
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Static File Server
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 LHP Dev Tracker Server Running!`);
  console.log(`📍 Web Dashboard: http://localhost:${PORT}`);
  console.log(`💾 Tasks File: ${TASKS_FILE}`);
  console.log(`🛡️ Data is saved directly to your hard drive.`);
  console.log(`===================================================`);
});
