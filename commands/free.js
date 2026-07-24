const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const fs = require('fs');
const config = require('../config.js');
const CatLoggr = require('cat-loggr');
const users = require('../utils/users');
const linkvertise = require('../utils/linkvertise');

const log = new CatLoggr();

// Per-user cooldown set (keyed by userId)
const cooldowns = new Set();

// Pending Linkvertise verification sessions.
// Key: `${userId}:${service}` → { hash, service, filePath, createdAt }
const pending = new Map();

function _key(userId, service) {
  return `${userId}:${service}`;
}

// Clean up stale pending sessions older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pending.entries()) {
    if (now - v.createdAt > 10 * 60 * 1000) pending.delete(k);
  }
}, 60_000);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('free')
    .setDescription('Generate a free account for a specified service')
    .addStringOption((option) =>
      option.setName('service').setDescription('Service name (e.g. steam, crunchyroll)').setRequired(true),
    ),

  // Exposed so index.js button handler can call back into this module
  _pending: pending,
  _key,

  async execute(interaction) {
    const service = interaction.options.getString('service').toLowerCase().trim();
    const userId = interaction.user.id;

    // ── Channel restriction ───────────────────────────────────────────────────
    if (config.genChannel && interaction.channelId !== config.genChannel) {
      const embed = new MessageEmbed()
        .setColor(config.color.red)
        .setTitle('Wrong channel!')
        .setDescription(
          `The \`/free\` command can only be used in <#${config.genChannel}>!`,
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── Authorization ─────────────────────────────────────────────────────────
    if (!users.isAuthorized(userId)) {
      return interaction.reply({
        content: '❌ You are not authorized to use this bot.',
        ephemeral: true,
      });
    }

    // ── Generation limit ──────────────────────────────────────────────────────
    const limitCheck = users.checkLimit(userId, 'free');
    if (!limitCheck.allowed) {
      if (limitCheck.reason === 'not_authorized') {
        return interaction.reply({ content: '❌ You are not authorized to use this bot.', ephemeral: true });
      }
      return interaction.reply({
        content: `❌ You have reached your free generation limit (${limitCheck.limit ?? config.freeLimit}).`,
        ephemeral: true,
      });
    }

    // ── Cooldown ──────────────────────────────────────────────────────────────
    if (cooldowns.has(userId)) {
      const embed = new MessageEmbed()
        .setColor(config.color.red)
        .setTitle('Cooldown!')
        .setDescription(`Please wait **${config.genCooldown}** seconds before generating again.`)
        .setFooter(interaction.user.tag, interaction.user.displayAvatarURL({ dynamic: true, size: 64 }))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── Validate stock file ───────────────────────────────────────────────────
    const filePath = `${__dirname}/../free/${service}.txt`;
    let fileData;
    try {
      fileData = fs.readFileSync(filePath, 'utf-8');
    } catch {
      const embed = new MessageEmbed()
        .setColor(config.color.red)
        .setTitle('Service not found!')
        .setDescription(`The service \`${service}\` does not exist. Use \`/stock\` to see available services.`)
        .setFooter(interaction.user.tag, interaction.user.displayAvatarURL({ dynamic: true, size: 64 }))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const lines = fileData.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      const embed = new MessageEmbed()
        .setColor(config.color.yellow)
        .setTitle('Out of stock!')
        .setDescription(`The \`${service}\` service is currently empty. Please check back later.`)
        .setFooter(interaction.user.tag, interaction.user.displayAvatarURL({ dynamic: true, size: 64 }))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── Linkvertise gate (if configured) ─────────────────────────────────────
    if (linkvertise.isConfigured()) {
      let lvLink;
      try {
        lvLink = linkvertise.generateLink(userId);
      } catch (e) {
        log.error(e);
        return interaction.reply({ content: '❌ Failed to generate verification link.', ephemeral: true });
      }

      pending.set(_key(userId, service), {
        hash: lvLink.hash,
        service,
        filePath,
        createdAt: Date.now(),
      });

      const embed = new MessageEmbed()
        .setColor(config.color.default)
        .setTitle('Verification Required')
        .setDescription(
          `To receive your **${service}** account, you must complete the link below.\n\n` +
          `**[👉 Click here to verify](${lvLink.url})**\n\n` +
          `After completing the link, press **Verify** below.\n` +
          `⏳ This session expires in **10 minutes**.`,
        )
        .setFooter(interaction.user.tag, interaction.user.displayAvatarURL({ dynamic: true, size: 64 }))
        .setTimestamp();

      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId(`lv_verify:${userId}:${service}`)
          .setLabel('✅ Verify')
          .setStyle('SUCCESS'),
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    // ── Direct delivery (no Linkvertise) ──────────────────────────────────────
    await _deliverAccount(interaction, userId, service, filePath);
  },

  /**
   * Called by the button handler in index.js after Linkvertise verification.
   */
  async handleVerify(interaction, userId, service) {
    const session = pending.get(_key(userId, service));
    if (!session) {
      return interaction.reply({
        content: '❌ No pending session found. Please run `/free` again.',
        ephemeral: true,
      });
    }

    // Re-check authorization and limit at verify time
    if (!users.isAuthorized(userId)) {
      pending.delete(_key(userId, service));
      return interaction.reply({ content: '❌ You are not authorized to use this bot.', ephemeral: true });
    }
    const limitCheck = users.checkLimit(userId, 'free');
    if (!limitCheck.allowed && !limitCheck.ownerBypass) {
      pending.delete(_key(userId, service));
      return interaction.reply({
        content: '❌ You have reached your free generation limit.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    // Verify with Linkvertise anti-bypass API
    const ok = await linkvertise.verifyCompletion(session.hash);
    if (!ok) {
      return interaction.editReply({
        content:
          '❌ Verification failed. Make sure you fully completed the Linkvertise link before pressing Verify.',
      });
    }

    // Deliver the account
    pending.delete(_key(userId, service));
    await _deliverAccount(interaction, userId, session.service, session.filePath, true);
  },
};

// ─── Shared delivery logic ────────────────────────────────────────────────────

async function _deliverAccount(interaction, userId, service, filePath, deferred = false) {
  let data;
  try {
    data = fs.readFileSync(filePath, 'utf-8');
  } catch {
    const msg = { content: `❌ Service \`${service}\` no longer exists.`, ephemeral: true };
    return deferred ? interaction.editReply(msg) : interaction.reply(msg);
  }

  const lines = data.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    const msg = { content: `❌ The \`${service}\` service is out of stock.`, ephemeral: true };
    return deferred ? interaction.editReply(msg) : interaction.reply(msg);
  }

  // Pop the first account
  const account = lines.shift();
  try {
    fs.writeFileSync(filePath, lines.join('\n'));
  } catch (e) {
    log.error(e);
    const msg = { content: '❌ Failed to update stock file. Please try again.', ephemeral: true };
    return deferred ? interaction.editReply(msg) : interaction.reply(msg);
  }

  // Send via DM – never expose credentials in a channel
  const dmEmbed = new MessageEmbed()
    .setColor(config.color.green)
    .setTitle('🎁 Free Account Generated')
    .addField('Service', `\`\`\`${_capitalize(service)}\`\`\``, true)
    .addField('Account', `\`\`\`${account}\`\`\``, true)
    .setImage(config.banner)
    .setFooter(config.footer)
    .setTimestamp();

  try {
    await interaction.user.send({ embeds: [dmEmbed] });
  } catch {
    // DM failed – restore the account to the top of the file
    try {
      const current = fs.readFileSync(filePath, 'utf-8');
      fs.writeFileSync(filePath, account + (current ? '\n' + current : ''));
    } catch (_) { /* best effort */ }
    const msg = { content: '❌ I could not DM you. Please enable your DMs and try again.', ephemeral: true };
    return deferred ? interaction.editReply(msg) : interaction.reply(msg);
  }

  // Increment usage counter
  users.incrementUsage(userId, 'free');

  // Apply cooldown
  cooldowns.add(userId);
  setTimeout(() => cooldowns.delete(userId), config.genCooldown * 1000);

  const success = { content: '✅ Account sent to your DMs!', ephemeral: true };
  return deferred ? interaction.editReply(success) : interaction.reply(success);
}

function _capitalize(str) {
  if (!str) return str;
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
}
