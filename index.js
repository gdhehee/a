const { Client, Intents, Collection } = require('discord.js');
const fs = require('fs');
const config = require('./config.js');

// Start the web dashboard server
require('./server.js');

// Register slash commands on startup
require('./deploy-commands.js');

// ─── Discord client ───────────────────────────────────────────────────────────
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

client.commands = new Collection();

const commandFiles = fs
  .readdirSync('./commands')
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity(config.status, { type: 'WATCHING' });
});

// ─── Interaction handler ──────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  // Handle Linkvertise verify button clicks
  if (interaction.isButton && interaction.isButton()) {
    if (interaction.customId && interaction.customId.startsWith('lv_verify:')) {
      try {
        const parts = interaction.customId.split(':');
        const userId = parts[1];
        const service = parts.slice(2).join(':');
        const freeCommand = client.commands.get('free');
        if (freeCommand && typeof freeCommand.handleVerify === 'function') {
          await freeCommand.handleVerify(interaction, userId, service);
        }
      } catch (error) {
        console.error('[button] Error handling verify:', error);
        try {
          await interaction.reply({ content: '❌ Verification error. Please try again.', ephemeral: true });
        } catch (_) { /* already replied */ }
      }
      return;
    }
  }

  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[command:${interaction.commandName}] Error:`, error);
    try {
      const errMsg = { content: '❌ An error occurred while running that command.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg);
      } else {
        await interaction.reply(errMsg);
      }
    } catch (_) { /* best effort */ }
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(config.token);
