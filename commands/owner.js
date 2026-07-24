const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const config = require('../config.js');
const users = require('../utils/users');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('Owner-only user management')
    .addSubcommand((sub) =>
      sub
        .setName('adduser')
        .setDescription('Authorize a user (free or premium)')
        .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Access type')
            .setRequired(true)
            .addChoices(
              { name: 'Free', value: 'free' },
              { name: 'Premium', value: 'premium' },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('removeuser')
        .setDescription('Remove an authorized user')
        .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub.setName('listusers').setDescription('List all authorized users'),
    ),

  async execute(interaction) {
    if (!users.isOwner(interaction.user.id)) {
      const embed = new MessageEmbed()
        .setColor(config.color.red)
        .setTitle('❌ Owner Only')
        .setDescription('This command can only be used by the bot owner.')
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    // ── adduser ───────────────────────────────────────────────────────────────
    if (sub === 'adduser') {
      const target = interaction.options.getUser('user');
      const type = interaction.options.getString('type');

      if (users.isOwner(target.id)) {
        return interaction.reply({ content: '❌ Cannot add the owner as a user.', ephemeral: true });
      }

      const result = users.addUser(target.id, type);
      if (!result.ok && result.reason === 'exists') {
        return interaction.reply({ content: `⚠️ <@${target.id}> is already authorized.`, ephemeral: true });
      }

      const embed = new MessageEmbed()
        .setColor(config.color.green)
        .setTitle('✅ User Authorized')
        .setDescription(`<@${target.id}> has been added as **${type}**.`)
        .addField('User ID', `\`${target.id}\``, true)
        .addField('Type', `\`${type}\``, true)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── removeuser ────────────────────────────────────────────────────────────
    if (sub === 'removeuser') {
      const target = interaction.options.getUser('user');
      const result = users.removeUser(target.id);

      if (!result.ok) {
        return interaction.reply({ content: `⚠️ <@${target.id}> is not in the authorized list.`, ephemeral: true });
      }

      const embed = new MessageEmbed()
        .setColor(config.color.red)
        .setTitle('🗑️ User Removed')
        .setDescription(`<@${target.id}> has been removed from the authorized list.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── listusers ─────────────────────────────────────────────────────────────
    if (sub === 'listusers') {
      const data = users.readUsers();

      if (!data.users.length) {
        const embed = new MessageEmbed()
          .setColor(config.color.yellow)
          .setTitle('Authorized Users')
          .setDescription('No users are currently authorized.')
          .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Resolve usernames from Discord – fall back to ID if unavailable
      const lines = [];
      for (const u of data.users) {
        let tag = 'Unknown';
        try {
          const fetched = await interaction.client.users.fetch(u.id);
          if (fetched) tag = fetched.tag;
        } catch (_) { /* keep default */ }

        lines.push(
          `**${tag}** (\`${u.id}\`)\n` +
          `• Type: \`${u.type}\`  |  Free: \`${u.freeUsed || 0}/${u.freeLimit ?? config.freeLimit}\`  |  Premium: \`${u.premiumUsed || 0}/${u.premiumLimit ?? config.premiumLimit}\``,
        );
      }

      // Chunk to respect Discord embed 4096-char description limit
      const chunks = [];
      let current = '';
      for (const line of lines) {
        const candidate = current ? current + '\n\n' + line : line;
        if (candidate.length > 3800) {
          chunks.push(current);
          current = line;
        } else {
          current = candidate;
        }
      }
      if (current) chunks.push(current);

      const firstEmbed = new MessageEmbed()
        .setColor(config.color.default)
        .setTitle(`Authorized Users (${data.users.length})`)
        .setDescription(chunks[0])
        .setTimestamp();

      await interaction.reply({ embeds: [firstEmbed], ephemeral: true });

      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({
          embeds: [new MessageEmbed().setColor(config.color.default).setDescription(chunks[i])],
          ephemeral: true,
        });
      }
    }
  },
};
