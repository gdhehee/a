const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const config = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display available commands'),

  async execute(interaction) {
    const embed = new MessageEmbed()
      .setColor(config.color.default)
      .setTitle('📋 Help Panel')
      .setDescription(
        `👋 Welcome to **${interaction.guild.name}**!\n` +
        `Here is a list of all available commands.`,
      )
      .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addField(
        '🆓 User Commands',
        [
          '`/free [service]` — Generate a free account',
          '`/premium [service]` — Generate a premium account',
          '`/stock` — View current service stock',
          '`/help` — Show this help panel',
        ].join('\n'),
        false,
      )
      .addField(
        '🔧 Admin Commands',
        [
          '`/create [service] [type]` — Create a new service',
          '`/add [type] [service] [account]` — Add an account to a service',
          '`/owner adduser` — Authorize a user',
          '`/owner removeuser` — Remove a user',
          '`/owner listusers` — List all authorized users',
        ].join('\n'),
        false,
      )
      .setImage(config.banner)
      .setFooter(config.footer)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
