const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.js');
const users = require('../utils/users');

/**
 * Reads all .txt files in a folder and counts non-empty lines.
 * Returns: { serviceName: count, ... }
 */
function getStock(folderPath) {
  const result = {};
  try {
    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith('.txt'));
    for (const file of files) {
      const name = path.basename(file, '.txt');
      const content = fs.readFileSync(path.join(folderPath, file), 'utf-8');
      const count = content.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
      result[name] = count;
    }
  } catch (e) {
    console.error('[stock] Error reading folder:', folderPath, e.message);
  }
  return result;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Display current service stock levels'),

  async execute(interaction) {
    if (!users.isAuthorized(interaction.user.id)) {
      return interaction.reply({ content: '❌ You are not authorized to use this bot.', ephemeral: true });
    }

    const freeDir = path.join(__dirname, '..', 'free');
    const premiumDir = path.join(__dirname, '..', 'premium');

    const freeStock = getStock(freeDir);
    const premiumStock = getStock(premiumDir);

    const formatStock = (stockObj) => {
      const entries = Object.entries(stockObj);
      if (entries.length === 0) return '`None`';
      return entries
        .map(([name, count]) => {
          const icon = count > 0 ? '🟢' : '🔴';
          return `${icon} \`${_capitalize(name)}\` — **${count}** in stock`;
        })
        .join('\n');
    };

    const totalFree = Object.values(freeStock).reduce((a, b) => a + b, 0);
    const totalPremium = Object.values(premiumStock).reduce((a, b) => a + b, 0);

    const embed = new MessageEmbed()
      .setColor(config.color.default)
      .setTitle('📦 Stock Overview')
      .addField(`🆓 Free (${totalFree} total)`, formatStock(freeStock), false)
      .addField(`⭐ Premium (${totalPremium} total)`, formatStock(premiumStock), false)
      .setFooter(interaction.user.tag, interaction.user.displayAvatarURL({ dynamic: true, size: 64 }))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

function _capitalize(str) {
  if (!str) return str;
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
}
