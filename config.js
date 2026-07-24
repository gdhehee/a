/**
 * config.js – single source of truth for all bot settings.
 * All values are read from environment variables.
 * Copy .env.example to .env and fill in your values for local development.
 */
require('dotenv').config();

function requireEnv(key) {
  const val = process.env[key];
  if (!val) {
    console.error(`[config] Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return val;
}

function optionalEnv(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

module.exports = {
  // Discord
  token: requireEnv('DISCORD_TOKEN'),
  clientId: requireEnv('DISCORD_CLIENT_ID'),
  guildId: requireEnv('DISCORD_GUILD_ID'),
  globalDeploy: optionalEnv('GLOBAL_DEPLOY', 'false').toLowerCase() === 'true',

  // Bot behaviour
  ownerId: optionalEnv('OWNER_ID', ''),
  status: optionalEnv('BOT_STATUS', 'Hacking minecraft accounts'),
  genChannel: optionalEnv('GEN_CHANNEL_ID', ''),
  premiumChannel: optionalEnv('PREMIUM_CHANNEL_ID', ''),
  genCooldown: parseInt(optionalEnv('GEN_COOLDOWN', '1800'), 10),
  premiumCooldown: parseInt(optionalEnv('PREMIUM_COOLDOWN', '900'), 10),
  freeLimit: parseInt(optionalEnv('FREE_LIMIT', '5'), 10),
  premiumLimit: parseInt(optionalEnv('PREMIUM_LIMIT', '5'), 10),

  // Embeds
  banner: optionalEnv('BANNER_URL', 'https://media.discordapp.net/attachments/960440723369517106/996423763522506782/rainbow-border.gif'),
  footer: optionalEnv('EMBED_FOOTER', 'Made By Nokiatis'),

  // Dashboard
  port: parseInt(optionalEnv('PORT', '3000'), 10),
  username: optionalEnv('DASHBOARD_USERNAME', 'admin'),
  password: optionalEnv('DASHBOARD_PASSWORD', 'changeme'),
  sessionSecret: optionalEnv('SESSION_SECRET', 'change_this_secret'),

  // Linkvertise (optional – leave blank to disable)
  LINKVERTISE_URL: optionalEnv('LINKVERTISE_URL', ''),
  LINKVERTISE_ANTI_BYPASS_TOKEN: optionalEnv('LINKVERTISE_ANTI_BYPASS_TOKEN', ''),

  // Embed colours
  color: {
    green: '0x57F287',
    yellow: '0xFEE75C',
    red: '0xED4245',
    default: '0x5865F2',
  },
};
