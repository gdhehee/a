const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const fs = require('fs');
const config = require('../config.js');
const CatLoggr = require('cat-loggr');
const users = require('../utils/users');

const log = new CatLoggr();
const cooldowns = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Generate a premium account for a specified service')
    .addStringOption((option) =>
      option.setName('service').setDescription('Service name (e.g. spotify, nitro)').setRequired(true),
    ),

  async execute(interaction) {
    const service = interaction.options.getString('service').toLowerCase().trim();
    const userId = interaction.user.id;

    // ── Channel restriction ───────────────────────────────────────────────────
    if (config.premiumChannel && interaction.channelId !== config.premiumChannel) {
      const embed = new MessageEmbed()
        .setColor(config.color.red)
        .setTitle('Wrong channel!')
        .setDescription(`The \`/premium\` command can only be used in <#${config.premiumChannel}>!`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── Authorization ─────────────────────────────────────────────────────────
    if (!users.isAuthorized(userId)) {
      return interaction.reply({ content: '❌ You are not authorized to use this bot.', ephemeral: true });
    }

    // ── Premium-only check ────────────────────────────────────────────────────
    if (!users.isOwner(userId)) {
      const u = users.findUser(userId);
      if (!u || u.type !== 'premium') {
        return interaction.reply({
          content: '❌ This command is for premium members only. Contact an admin to upgrade.',
          ephemeral: true,
        });
      }
    }

    // ── Limit check ───────────────────────────────────────────────────────────
    const limitCheck = users.checkLimit(userId, 'premium');
    if (!limitCheck.allowed && !limitCheck.ownerBypass) {
      if (limitCheck.reason === 'premium_only') {
        return interaction.reply({ content: '❌ Premium users only.', ephemeral: true });
      }
      return interaction.reply({
        content: `❌ You have reached your premium generation limit (${limitCheck.limit ?? config.premiumLimit}).`,
        ephemeral: true,
      });
    }

    // ── Cooldown ──────────────────────────────────────────────────────────────
    if (cooldowns.has(userId)) {
      const embed = new MessageEmbed()
        .setColor(config.color.red)
        .setTitle('Cooldown!')
        .setDescription(`Please wait **${config.premiumCooldown}** seconds before generating again.`)
        .setFooter(interaction.user.tag, interaction.user.displayAvatarURL({ dynamic: true, size: 64 }))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── Read stock file ───────────────────────────────────────────────────────
    const filePath = `${__dirname}/../premium/${service}.txt`;
    let data;
    try {
      data = fs.readFileSync(filePath, 'utf-8');
    } catch {
      const embed = new MessageEmbed()
        .setColor(config.color.red)
        .setTitle('Service not found!')
        .setDescription(`The service \`${service}\` does not exist. Use \`/stock\` to see available services.`)
        .setFooter(interaction.user.tag, interaction.user.displayAvatarURL({ dynamic: true, size: 64 }))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const lines = data.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      const embed = new MessageEmbed()
        .setColor(config.color.yellow)
        .setTitle('Out of stock!')
        .setDescription(`The \`${service}\` service is currently empty. Please check back later.`)
        .setFooter(interaction.user.tag, interaction.user.displayAvatarURL({ dynamic: true, size: 64 }))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── Deliver account ───────────────────────────────────────────────────────
    const account = lines.shift();
    try {
      fs.writeFileSync(filePath, lines.join('\n'));
    } catch (e) {
      log.error(e);
      return interaction.reply({ content: '❌ Failed to update stock file. Please try again.', ephemeral: true });
    }

    const dmEmbed = new MessageEmbed()
      .setColor(config.color.green)
      .setTitle('⭐ Premium Account Generated')
      .setDescription('🙏 Thank you for being a premium member! Your support means the world to us. 💖')
      .addField('Service', `\`\`\`${_capitalize(service)}\`\`\``, true)
      .addField('Account', `\`\`\`${account}\`\`\``, true)
      .setImage(config.banner)
      .setFooter(config.footer)
      .setTimestamp();

    try {
      await interaction.user.send({ embeds: [dmEmbed] });
    } catch {
      // DM failed – restore account
      try {
        const current = fs.readFileSync(filePath, 'utf-8');
        fs.writeFileSync(filePath, account + (current ? '\n' + current : ''));
      } catch (_) { /* best effort */ }
      return interaction.reply({ content: '❌ I could not DM you. Please enable your DMs and try again.', ephemeral: true });
    }

    users.incrementUsage(userId, 'premium');
    cooldowns.add(userId);
    setTimeout(() => cooldowns.delete(userId), config.premiumCooldown * 1000);

    return interaction.reply({ content: '✅ Account sent to your DMs!', ephemeral: true });
  },
};

function _capitalize(str) {
  if (!str) return str;
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
}
