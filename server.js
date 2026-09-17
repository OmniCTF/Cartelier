'use strict';

const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FLAG = process.env.FLAG || 'CTF{XSS_can_read_pages}';
const ADMIN_SESSION = process.env.ADMIN_SESSION || crypto.randomBytes(32).toString('hex');
const BOT_BASE_URL = process.env.BOT_BASE_URL || `http://127.0.0.1:${PORT}`;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const inboxes = new Map();
const reportTimes = new Map();
let botBusy = false;

app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '12kb' }));
app.use(express.json({ limit: '120kb' }));
app.use(cookieParser());
app.use('/static', express.static('public', { maxAge: '1h' }));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} · Cartelier</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <nav><a class="brand" href="/">Cartelier<span>.</span></a><div><a href="/">Shop</a><a href="/support">Support</a><a href="/login">Sign in</a></div></nav>
  <main>${body}</main>
  <footer>© 2026 Cartelier Commerce · Thoughtful objects, delivered.</footer>
</body>
</html>`;
}

app.get('/', (req, res) => {
  const products = [
    ['Linen Weekender', 'Sand-washed linen, vegetable-tanned leather.', '$128'],
    ['Orbit Desk Lamp', 'Warm dimmable light in brushed aluminium.', '$84'],
    ['Stoneware Set', 'Four hand-glazed cups made in small batches.', '$56']
  ].map(([name, desc, price], i) => `<article class="product"><div class="product-art art-${i}"></div><p class="eyebrow">NEW SEASON</p><h2>${name}</h2><p>${desc}</p><div class="buy"><strong>${price}</strong><button>Add to bag</button></div></article>`).join('');
  res.send(layout('Shop', `<section class="hero"><div><p class="eyebrow">THE AUTUMN EDIT</p><h1>Less noise.<br>Better things.</h1><p>Useful, enduring goods selected for everyday life.</p><a class="button" href="#collection">Explore collection</a></div><div class="hero-shape"></div></section><section id="collection"><div class="section-head"><h2>Featured objects</h2><span>Curated weekly</span></div><div class="grid">${products}</div></section>`));
});

app.get('/login', (req, res) => {
  // Intentional challenge vulnerability: `error` is inserted without HTML escaping.
  const error = req.query.error ? `<div class="alert">${req.query.error}</div>` : '';
  res.send(layout('Sign in', `<section class="auth-card"><p class="eyebrow">MEMBER ACCESS</p><h1>Welcome back</h1><p class="muted">Sign in to track orders and save your favourites.</p>${error}<form method="post" action="/login"><label>Email<input name="email" type="email" placeholder="you@example.com" required></label><label>Password<input name="password" type="password" placeholder="••••••••" required></label><button type="submit">Sign in</button></form><p class="fine">New here? <a href="/support">Contact our concierge</a>.</p></section>`));
});

app.post('/login', (req, res) => {
  const email = String(req.body.email || '').slice(0, 100);
  res.redirect(`/login?error=${encodeURIComponent(`No account was found for ${email}.`)}`);
});

app.get('/admin', (req, res) => {
  if (req.cookies.session !== ADMIN_SESSION) {
    return res.status(403).send(layout('Access denied', '<section class="auth-card"><p class="eyebrow">STAFF ONLY</p><h1>Access denied</h1><p class="muted">A valid staff session is required.</p></section>'));
  }
  res.send(layout('Operations', `<section class="admin"><div class="section-head"><div><p class="eyebrow">STAFF PORTAL</p><h1>Fulfilment overview</h1></div><span class="status">Live</span></div><div class="stats"><div><span>Orders today</span><strong>184</strong></div><div><span>Awaiting dispatch</span><strong>37</strong></div><div><span>Revenue</span><strong>$18,429</strong></div></div><article class="manifest"><p class="eyebrow">PRIVATE COURIER NOTE · ORDER #CT-0917</p><h2>High-value shipment authorization</h2><p>The courier verification phrase for today's secure collection is:</p><code>${escapeHtml(FLAG)}</code></article></section>`));
});

app.get('/support', (req, res) => {
  res.send(layout('Support', `<section class="support"><div><p class="eyebrow">CUSTOMER CARE</p><h1>How can we help?</h1><p>Our staff review reported storefront problems in an authenticated browser.</p><ol><li>Create a private reply inbox.</li><li>Report the storefront path that is misbehaving.</li><li>Review replies sent to your inbox.</li></ol></div><div class="panel"><h2>Report a page</h2><form id="report-form"><label>Path to review<input name="path" placeholder="/login?error=..." maxlength="4096" required></label><button>Ask staff to review</button></form><p id="report-result" class="fine"></p><hr><h2>Private reply inbox</h2><button id="create-inbox" class="secondary">Create inbox</button><p id="inbox-result" class="fine"></p></div></section><script src="/static/support.js"></script>`));
});

app.post('/api/inboxes', (req, res) => {
  const id = crypto.randomBytes(12).toString('hex');
  inboxes.set(id, { created: Date.now(), messages: [] });
  res.status(201).json({ id, url: `/inbox/${id}` });
});

app.post('/api/inboxes/:id/messages', (req, res) => {
  const inbox = inboxes.get(req.params.id);
  if (!inbox) return res.status(404).json({ error: 'Inbox not found' });
  const message = String(req.body.message || '').slice(0, 100000);
  if (!message) return res.status(400).json({ error: 'Message is required' });
  inbox.messages.push({ message, at: Date.now() });
  if (inbox.messages.length > 10) inbox.messages.shift();
  res.status(201).json({ ok: true });
});

app.get('/inbox/:id', (req, res) => {
  const inbox = inboxes.get(req.params.id);
  if (!inbox) return res.status(404).send(layout('Not found', '<section class="auth-card"><h1>Inbox not found</h1></section>'));
  const messages = inbox.messages.length
    ? inbox.messages.map((item) => `<article class="message"><time>${new Date(item.at).toISOString()}</time><pre>${escapeHtml(item.message)}</pre></article>`).join('')
    : '<p class="empty">No replies yet. Refresh after staff review.</p>';
  res.send(layout('Reply inbox', `<section class="inbox"><p class="eyebrow">PRIVATE REPLY INBOX</p><h1>Support messages</h1><p class="muted">Inbox <code>${escapeHtml(req.params.id)}</code></p>${messages}</section>`));
});

function safeReviewUrl(input) {
  if (typeof input !== 'string' || input.length > 4096 || !input.startsWith('/')) return null;
  try {
    const base = new URL(BOT_BASE_URL);
    const target = new URL(input, base);
    return target.origin === base.origin ? target.href : null;
  } catch {
    return null;
  }
}

async function adminVisit(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--js-flags=--jitless']
    });
    const page = await browser.newPage();
    await page.setCookie({
      name: 'session', value: ADMIN_SESSION, url: BOT_BASE_URL,
      httpOnly: true, sameSite: 'Strict', secure: BOT_BASE_URL.startsWith('https://')
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await new Promise((resolve) => setTimeout(resolve, 4000));
  } catch (error) {
    console.error('[bot] visit failed:', error.message);
  } finally {
    if (browser) await browser.close();
    botBusy = false;
  }
}

app.post('/api/report', (req, res) => {
  const url = safeReviewUrl(req.body.path);
  if (!url) return res.status(400).json({ error: 'Only local storefront paths are accepted.' });
  const client = req.ip;
  const now = Date.now();
  if (now - (reportTimes.get(client) || 0) < 5000) return res.status(429).json({ error: 'Please wait before sending another report.' });
  if (botBusy) return res.status(429).json({ error: 'Staff are reviewing another report. Try again shortly.' });
  reportTimes.set(client, now);
  botBusy = true;
  setImmediate(() => adminVisit(url));
  res.status(202).json({ ok: true, message: 'A staff member will review this path now.' });
});

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, inbox] of inboxes) if (inbox.created < cutoff) inboxes.delete(id);
  for (const [ip, time] of reportTimes) if (time < cutoff) reportTimes.delete(ip);
}, 10 * 60 * 1000).unref();

app.listen(PORT, '0.0.0.0', () => console.log(`Cartelier listening on 0.0.0.0:${PORT}`));
