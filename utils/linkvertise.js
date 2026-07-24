/**
 * utils/linkvertise.js
 * Linkvertise anti-bypass integration (optional).
 *
 * Leave LINKVERTISE_PUBLISHER_ID and LINKVERTISE_ANTI_BYPASS_TOKEN blank to
 * disable Linkvertise. When disabled, /free delivers accounts immediately.
 */
const config = require('../config.js');

// node-fetch v2 is CJS-compatible; v3+ is ESM-only.
const _fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function _creds() {
  return {
    publisherId: config.LINKVERTISE_PUBLISHER_ID || '',
    antiBypassToken: config.LINKVERTISE_ANTI_BYPASS_TOKEN || '',
  };
}

function _randomHash() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Returns true if Linkvertise credentials are configured.
 */
function isConfigured() {
  const { publisherId, antiBypassToken } = _creds();
  return Boolean(publisherId && antiBypassToken);
}

/**
 * Generates a Linkvertise link-hub URL for a given userId.
 * Returns { hash, url, userId }.
 * Throws if Linkvertise is not configured.
 */
function generateLink(userId) {
  const { publisherId, antiBypassToken } = _creds();
  if (!publisherId || !antiBypassToken) {
    throw new Error(
      'Linkvertise is not configured. Set LINKVERTISE_PUBLISHER_ID and LINKVERTISE_ANTI_BYPASS_TOKEN.',
    );
  }
  const hash = _randomHash();
  const url = `https://link-hub.net/${encodeURIComponent(publisherId)}/${hash}`;
  return { hash, url, userId: String(userId) };
}

/**
 * Verifies link completion via Linkvertise's anti-bypass API.
 * Returns true only if Linkvertise confirms the hash was completed.
 * On any error, returns false (fail closed – never bypass on errors).
 */
async function verifyCompletion(hash) {
  if (!hash || typeof hash !== 'string') return false;
  const { antiBypassToken } = _creds();
  if (!antiBypassToken) return false;

  const endpoint =
    `https://publisher.linkvertise.com/api/v1/anti_bypassing` +
    `?token=${encodeURIComponent(antiBypassToken)}` +
    `&hash=${encodeURIComponent(hash)}`;

  try {
    const res = await _fetch(endpoint, { method: 'POST' });
    if (!res.ok) return false;
    const text = (await res.text()).trim();
    if (/^true$/i.test(text)) return true;
    try {
      const json = JSON.parse(text);
      if (json === true) return true;
      if (json && (json.success === true || json.valid === true || json.status === true)) return true;
    } catch (_) { /* not JSON */ }
    return false;
  } catch (e) {
    console.error('[linkvertise] verifyCompletion error:', e.message);
    return false;
  }
}

module.exports = { isConfigured, generateLink, verifyCompletion };
