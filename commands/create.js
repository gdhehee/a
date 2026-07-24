const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.js');
const CatLoggr = require('cat-loggr');
const users = require('../utils/users');

const log = new CatLoggr();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new service file (admin only)')
    .addStringOption((option) =>
      option
        .setName('service')
        .setDescription('Name for the new service (e.g. netflix)')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Service type')
        .setRequired(true)
        .addChoices(
          { name: 'Free', value: 'free' },
          { name: 'Premium', value: 'premium' },
        ),
    ),

  async execute(interaction) {
    const service = interaction.options.getString('service').toLowerCase().trim();
    const type = interaction.options.getString('type');

    if (!users.isAuthorized(interaction.user.id)) {
      return interaction.reply({ content: '❌ You are not authorized to use this bot.', ephemeral: true });
    }

    // Require owner or Discord MANAGE_CHANNELS permission
    if (!users.isOwner(interaction.user.id) && !interaction.member.permissions.has('MANAGE_CHANNELS')) {
      return interaction.reply({
        content: '❌ You need the **Manage Channels** permission (or owner status) to create services.',
        ephemeral: true,
      });
    }

    // Validate service name (alphanumeric + underscore + hyphen only)
    if (!/^[a-z0-9_-]+$/.test(service)) {
      return interaction.reply({
        content: '❌ Service name must only contain letters, numbers, hyphens, and underscores.',
        ephemeral: true,
      });
    }

    const folder = type === 'free' ? 'free' : 'premium';
    const filePath = path.join(__dirname, '..', folder, `${service}.txt`);

    if (fs.existsSync(filePath)) {
      return interaction.reply({
        content: `❌ A \`${type}\` service named \`${service}\` already exists.`,
        ephemeral: true,
      });
    }

    try {
      fs.writeFileSync(filePath, '');
    } catch (e) {
      log.error(e);
      return interaction.reply({ content: '❌ Failed to create the service file.', ephemeral: true });
    }

    const embed = new MessageEmbed()
      .setColor(config.color.green)
      .setTitle('✅ Service Created')
      .addField('Service', `\`${service}\``, true)
      .addField('Type', `\`${type}\``, true)
      .setDescription(`Use \`/add\` to add accounts to this service.`)
      .setFooter(interaction.user.tag, interaction.user.displayAvatarURL({ dynamic: true, size: 64 }))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
