/**
 * server.js – Express web dashboard for the NOKIATIS bot.
 *
 * Routes:
 *   GET  /           → login page
 *   POST /login      → authenticate
 *   GET  /signout    → clear session
 *   GET  /edit       → dashboard (requires login)
 *   GET  /edit/:folder/:file → file editor
 *   POST /save       → save file contents
 *   POST /create     → create a new stock file
 *   POST /delete     → delete a stock file
 *   POST /rename     → rename a stock file
 *   POST /settings   → update bot config values
 *   GET  /healthz    → health check (for Render)
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const config = require('./config.js');

const app = express();

app.use(express.static(path.join(__dirname, 'dashboard')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireLogin(req, res, next) {
  if (req.cookies && req.cookies.user) return next();
  res.sendFile(path.join(__dirname, 'dashboard', 'accessdecline.html'));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countNonEmptyLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}

function countLinesInFolder(folderPath) {
  try {
    return fs
      .readdirSync(folderPath)
      .filter((f) => f.endsWith('.txt'))
      .reduce((total, f) => total + countNonEmptyLines(path.join(folderPath, f)), 0);
  } catch {
    return 0;
  }
}

function getStockList(folderPath) {
  try {
    return fs
      .readdirSync(folderPath)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => ({ file: f, count: countNonEmptyLines(path.join(folderPath, f)) }));
  } catch {
    return [];
  }
}

const FREE_DIR = path.join(__dirname, 'free');
const PREMIUM_DIR = path.join(__dirname, 'premium');

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/healthz', (_req, res) => res.send('ok'));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === config.username && password === config.password) {
    res.cookie('user', username, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true });
    res.redirect('/edit');
  } else {
    res.sendFile(path.join(__dirname, 'dashboard', 'invalidlogin.html'));
  }
});

app.get('/signout', (_req, res) => {
  res.clearCookie('user');
  res.redirect('/');
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

app.get('/edit', requireLogin, (_req, res) => {
  const freeLines = countLinesInFolder(FREE_DIR);
  const premiumLines = countLinesInFolder(PREMIUM_DIR);
  const freeFiles = getStockList(FREE_DIR);
  const premiumFiles = getStockList(PREMIUM_DIR);

  const fileRow = (folder, { file, count }) => `
    <div class="file-item">
      <span class="file-icon"><i class="fa fa-file-text-o"></i></span>
      <a href="/edit/${folder}/${file}" class="file-name">${file} <span class="badge">${count}</span></a>
      <div class="file-actions">
        <button class="rename-button" onclick="openRenameModal('${folder}','${file}')">Rename</button>
        <button class="delete-button" onclick="deleteFile('${folder}','${file}')">Delete</button>
      </div>
    </div>`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NOKIATIS Dashboard</title>
  <link rel="icon" href="https://cdn.discordapp.com/attachments/1152538414017687684/1154710899525947422/gift.jpg" type="image/jpg">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ScienceGear/giftmaster-slash@main/youcandeletethis/style.css">
  <script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
  <script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>
  <style>
    :root { --green: #57F287; }
    .badge { background: var(--green); color: #111; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; margin-left: 6px; }
    .file-item { display:flex; align-items:center; padding:10px; background:#fff; border-radius:6px; margin-bottom:8px; border:2px solid transparent; transition:.2s; }
    .file-item:hover { border-color: #5865F2; background:#f5f5ff; }
    .file-icon { margin-right:10px; font-size:20px; color:#5865F2; }
    .file-name { flex:1; text-decoration:none; color:#5865F2; font-size:0.95rem; display:flex; align-items:center; }
    .file-actions { display:flex; gap:6px; }
    .rename-button { background:#57F287; color:#111; border:none; border-radius:5px; padding:5px 12px; cursor:pointer; font-size:0.85rem; transition:.2s; }
    .rename-button:hover { background:#3dbf6f; }
    .delete-button { background:#ED4245; color:#fff; border:none; border-radius:5px; padding:5px 12px; cursor:pointer; font-size:0.85rem; transition:.2s; }
    .delete-button:hover { background:#c0392b; }
    .section-title { font-size:1.2rem; color:#5865F2; margin:16px 0 8px; font-weight:600; }
    .fancy-button { background:#5865F2; color:#fff; border:none; border-radius:5px; padding:10px 22px; cursor:pointer; font-size:0.95rem; transition:.2s; }
    .fancy-button:hover { background:#4752c4; }
    .fancy-input input, .fancy-input select { width:100%; padding:8px 12px; border-radius:5px; border:1px solid #ccc; font-size:0.95rem; margin-bottom:10px; }
    .modal { display:none; position:fixed; top:0;left:0;width:100%;height:100%; background:rgba(0,0,0,.4); z-index:999; }
    .modal-box { background:#fff; border-radius:10px; padding:24px; width:320px; margin:15% auto; position:relative; }
    .modal-box h3 { margin-top:0; }
    .modal-box input { width:100%; padding:8px; border:1px solid #ccc; border-radius:5px; margin:10px 0 16px; font-size:0.95rem; }
    .settings-form label { display:block; font-weight:500; margin-bottom:4px; margin-top:12px; }
    .settings-form input { width:100%; padding:8px 12px; border-radius:5px; border:1px solid #ccc; font-size:0.95rem; box-sizing:border-box; }
    .settings-form button { margin-top:16px; }
  </style>
</head>
<body>
<div class="container">
  <div class="navigation">
    <ul>
      <li><a href="#"><span class="icon"><ion-icon name="gift-outline"></ion-icon></span><span class="title">NOKIATIS</span></a></li>
      <li class="active"><a href="/edit"><span class="icon"><ion-icon name="home-outline"></ion-icon></span><span class="title">Dashboard</span></a></li>
      <li><a href="/signout"><span class="icon"><ion-icon name="log-out-outline"></ion-icon></span><span class="title">Sign Out</span></a></li>
    </ul>
  </div>

  <div class="main">
    <div class="topbar"><div class="toggle"><ion-icon name="menu-outline"></ion-icon></div></div>

    <div class="cardBox">
      <div class="card"><div><div class="numbers">${freeLines + premiumLines}</div><div class="cardName">Total Stock</div></div><div class="iconBx"><ion-icon name="eye-outline"></ion-icon></div></div>
      <div class="card"><div><div class="numbers">${freeLines}</div><div class="cardName">Free</div></div><div class="iconBx"><ion-icon name="cart-outline"></ion-icon></div></div>
      <div class="card"><div><div class="numbers">${premiumLines}</div><div class="cardName">Premium</div></div><div class="iconBx"><ion-icon name="cash-outline"></ion-icon></div></div>
    </div>

    <div style="display:flex;gap:12px;margin:16px 0 8px;flex-wrap:wrap;">
      <button class="fancy-button" onclick="document.getElementById('create-modal').style.display='flex'">＋ Create Service</button>
    </div>

    <div class="section-title">🆓 Free Stock Files</div>
    ${freeFiles.length ? freeFiles.map((f) => fileRow('free', f)).join('') : '<p style="color:#888">No free services yet.</p>'}

    <div class="section-title">⭐ Premium Stock Files</div>
    ${premiumFiles.length ? premiumFiles.map((f) => fileRow('premium', f)).join('') : '<p style="color:#888">No premium services yet.</p>'}

    <div class="section-title">⚙️ Settings</div>
    <form class="settings-form" method="POST" action="/settings">
      <label>Bot Status</label><input name="status" value="${_escape(config.status)}">
      <label>Free Cooldown (seconds)</label><input name="genCooldown" type="number" value="${config.genCooldown}">
      <label>Premium Cooldown (seconds)</label><input name="premiumCooldown" type="number" value="${config.premiumCooldown}">
      <label>Banner URL</label><input name="banner" value="${_escape(config.banner)}">
      <label>Embed Footer</label><input name="footer" value="${_escape(config.footer)}">
      <button class="fancy-button" type="submit">Save Settings</button>
    </form>
  </div>
</div>

<!-- Create modal -->
<div class="modal" id="create-modal" style="display:none;justify-content:center;align-items:center;">
  <div class="modal-box">
    <h3>Create New Service</h3>
    <form method="POST" action="/create">
      <label>Folder</label>
      <select name="folder" style="width:100%;padding:8px;border-radius:5px;border:1px solid #ccc;margin-bottom:10px;">
        <option value="free">Free</option>
        <option value="premium">Premium</option>
      </select>
      <label>Service Name</label>
      <input name="fileName" placeholder="e.g. netflix" required>
      <div style="display:flex;gap:8px;">
        <button class="fancy-button" type="submit">Create</button>
        <button class="fancy-button" type="button" onclick="document.getElementById('create-modal').style.display='none'" style="background:#888">Cancel</button>
      </div>
    </form>
  </div>
</div>

<!-- Rename modal -->
<div class="modal" id="rename-modal" style="display:none;justify-content:center;align-items:center;">
  <div class="modal-box">
    <h3>Rename File</h3>
    <input id="rename-input" placeholder="New name (without .txt)">
    <input type="hidden" id="rename-folder"><input type="hidden" id="rename-old">
    <div style="display:flex;gap:8px;">
      <button class="fancy-button" onclick="doRename()">Rename</button>
      <button class="fancy-button" type="button" onclick="document.getElementById('rename-modal').style.display='none'" style="background:#888">Cancel</button>
    </div>
  </div>
</div>

<script>
function openRenameModal(folder, file) {
  document.getElementById('rename-folder').value = folder;
  document.getElementById('rename-old').value = file;
  document.getElementById('rename-input').value = file.replace('.txt','');
  document.getElementById('rename-modal').style.display = 'flex';
}
function doRename() {
  const folder = document.getElementById('rename-folder').value;
  const oldName = document.getElementById('rename-old').value;
  const newName = document.getElementById('rename-input').value.trim();
  if (!newName) return alert('Name cannot be empty.');
  fetch('/rename', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ folder, oldName, newName }) })
    .then(r => r.json()).then(d => { if (d.ok) location.reload(); else alert(d.error || 'Rename failed.'); });
}
function deleteFile(folder, file) {
  if (!confirm('Delete ' + file + '? This cannot be undone.')) return;
  fetch('/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ folder, file }) })
    .then(r => r.json()).then(d => { if (d.ok) location.reload(); else alert(d.error || 'Delete failed.'); });
}
window.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) e.target.style.display = 'none';
});
</script>
</body>
</html>`);
});

// ─── File editor ──────────────────────────────────────────────────────────────

app.get('/edit/:folder/:file', requireLogin, (req, res) => {
  const folder = req.params.folder === 'premium' ? 'premium' : 'free';
  const file = path.basename(req.params.file);
  const filePath = path.join(__dirname, folder, file);

  if (!fs.existsSync(filePath)) return res.status(404).send('File not found.');

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit – ${file}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ScienceGear/giftmaster-slash@main/youcandeletethis/style.css">
  <style>
    body { font-family: sans-serif; }
    .editor-wrap { max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h2 { color: #5865F2; }
    textarea { width: 100%; height: 400px; padding: 12px; font-family: monospace; font-size: 0.9rem; border: 1px solid #ccc; border-radius: 6px; resize: vertical; box-sizing: border-box; }
    .btn { background: #5865F2; color: #fff; border: none; border-radius: 5px; padding: 10px 22px; cursor: pointer; font-size: 0.95rem; margin-right: 8px; }
    .btn:hover { background: #4752c4; }
    .btn-back { background: #888; }
    .info { color: #666; font-size: 0.88rem; margin-bottom: 12px; }
  </style>
</head>
<body>
<div class="editor-wrap">
  <h2>✏️ ${file} <span style="font-size:0.75em;color:#888">(${lines.length} accounts)</span></h2>
  <p class="info">One account per line. Blank lines are ignored. Save when done.</p>
  <form method="POST" action="/save">
    <input type="hidden" name="folder" value="${folder}">
    <input type="hidden" name="file" value="${file}">
    <textarea name="content">${_escape(content)}</textarea>
    <br><br>
    <button class="btn" type="submit">💾 Save</button>
    <a href="/edit"><button class="btn btn-back" type="button">← Back</button></a>
  </form>
</div>
</body>
</html>`);
});

// ─── POST routes ──────────────────────────────────────────────────────────────

app.post('/save', requireLogin, (req, res) => {
  const folder = req.body.folder === 'premium' ? 'premium' : 'free';
  const file = path.basename(req.body.file || '');
  const content = (req.body.content || '').replace(/\r\n/g, '\n');
  if (!file) return res.status(400).send('Bad request.');
  const filePath = path.join(__dirname, folder, file);
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found.');
  fs.writeFileSync(filePath, content);
  res.redirect('/edit');
});

app.post('/create', requireLogin, (req, res) => {
  const folder = req.body.folder === 'premium' ? 'premium' : 'free';
  const raw = (req.body.fileName || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
  if (!raw) return res.redirect('/edit');
  const filePath = path.join(__dirname, folder, `${raw}.txt`);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
  res.redirect('/edit');
});

app.post('/delete', requireLogin, (req, res) => {
  const folder = req.body.folder === 'premium' ? 'premium' : 'free';
  const file = path.basename(req.body.file || '');
  if (!file) return res.json({ ok: false, error: 'No file specified.' });
  const filePath = path.join(__dirname, folder, file);
  try {
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/rename', requireLogin, (req, res) => {
  const folder = req.body.folder === 'premium' ? 'premium' : 'free';
  const oldName = path.basename(req.body.oldName || '');
  const newName = (req.body.newName || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '') + '.txt';
  if (!oldName || !newName || newName === '.txt') return res.json({ ok: false, error: 'Invalid names.' });
  const oldPath = path.join(__dirname, folder, oldName);
  const newPath = path.join(__dirname, folder, newName);
  try {
    fs.renameSync(oldPath, newPath);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/settings', requireLogin, (req, res) => {
  // Update in-memory config (runtime only – Render env vars are the source of truth)
  const { status, genCooldown, premiumCooldown, banner, footer } = req.body;
  if (status !== undefined) config.status = status;
  if (genCooldown !== undefined) config.genCooldown = parseInt(genCooldown, 10) || config.genCooldown;
  if (premiumCooldown !== undefined) config.premiumCooldown = parseInt(premiumCooldown, 10) || config.premiumCooldown;
  if (banner !== undefined) config.banner = banner;
  if (footer !== undefined) config.footer = footer;
  res.redirect('/edit');
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`🌐 Dashboard running on port ${config.port}`);
});

module.exports = app;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _escape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
