const config = require('../config.js');
const fetch = require('node-fetch');

function _creds() {
  return {
    linkUrl: (config.LINKVERTISE_URL || '').trim(),
    antiBypassToken: (config.LINKVERTISE_ANTI_BYPASS_TOKEN || '').trim(),
  };
}

function _randomHash() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function isConfigured() {
  const { linkUrl, antiBypassToken } = _creds();
  return Boolean(linkUrl && antiBypassToken);
}

function generateLink(userId) {
  const { linkUrl, antiBypassToken } = _creds();
  if (!linkUrl || !antiBypassToken) {
    throw new Error('Linkvertise not configured. Set LINKVERTISE_URL and LINKVERTISE_ANTI_BYPASS_TOKEN.');
  }
  const hash = _randomHash();
  const separator = linkUrl.includes('?') ? '&' : '?';
  const url = `${linkUrl}${separator}unique_id=${hash}`;
  return { hash, url, userId: String(userId) };
}

async function verifyCompletion(hash) {
  if (!hash || typeof hash !== 'string') return false;
  const { antiBypassToken } = _creds();
  if (!antiBypassToken) return false;

  const endpoint =
    `https://publisher.linkvertise.com/api/v1/anti_bypassing` +
    `?token=${encodeURIComponent(antiBypassToken)}` +
    `&hash=${encodeURIComponent(hash)}`;

  try {
    const res = await fetch(endpoint, { method: 'POST' });
    if (!res.ok) return false;
    const text = (await res.text()).trim();
    if (/^true$/i.test(text)) return true;
    try {
      const json = JSON.parse(text);
      if (json === true) return true;
      if (json && (json.success === true || json.valid === true || json.status === true)) return true;
    } catch (_) {}
    return false;
  } catch (e) {
    console.error('[linkvertise] verifyCompletion error:', e.message);
    return false;
  }
}

module.exports = { isConfigured, generateLink, verifyCompletion };
