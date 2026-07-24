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
    .setName('add')
    .setDescription('Add an account to a service (admin only)')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Service type')
        .setRequired(true)
        .addChoices(
          { name: 'Free', value: 'free' },
          { name: 'Premium', value: 'premium' },
        ),
    )
    .addStringOption((option) =>
      option.setName('service').setDescription('Service name').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('account').setDescription('Account credentials to add').setRequired(true),
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const service = interaction.options.getString('service').toLowerCase().trim();
    const account = interaction.options.getString('account').trim();

    if (!users.isAuthorized(interaction.user.id)) {
      return interaction.reply({ content: '❌ You are not authorized to use this bot.', ephemeral: true });
    }

    // Require owner or Discord MANAGE_CHANNELS permission
    if (!users.isOwner(interaction.user.id) && !interaction.member.permissions.has('MANAGE_CHANNELS')) {
      return interaction.reply({
        content: '❌ You need the **Manage Channels** permission (or owner status) to add accounts.',
        ephemeral: true,
      });
    }

    if (!account) {
      return interaction.reply({ content: '❌ Account cannot be empty.', ephemeral: true });
    }

    const folder = type === 'free' ? 'free' : 'premium';
    const filePath = path.join(__dirname, '..', folder, `${service}.txt`);

    if (!fs.existsSync(filePath)) {
      return interaction.reply({
        content: `❌ Service \`${service}\` (${type}) does not exist. Use \`/create\` first.`,
        ephemeral: true,
      });
    }

    try {
      const existing = fs.readFileSync(filePath, 'utf-8');
      const separator = existing.trimEnd().length > 0 ? '\n' : '';
      fs.writeFileSync(filePath, existing.trimEnd() + separator + account);
    } catch (e) {
      log.error(e);
      return interaction.reply({ content: '❌ Failed to write to the service file.', ephemeral: true });
    }

    const embed = new MessageEmbed()
      .setColor(config.color.green)
      .setTitle('✅ Account Added')
      .addField('Service', `\`${service}\``, true)
      .addField('Type', `\`${type}\``, true)
      .setFooter(interaction.user.tag, interaction.user.displayAvatarURL({ dynamic: true, size: 64 }))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
