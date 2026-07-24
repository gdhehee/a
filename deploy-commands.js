/**
 * deploy-commands.js
 *
 * Registers slash commands with Discord.
 * Called automatically on bot startup (guild deploy is fast and idempotent).
 * For global deployment, set GLOBAL_DEPLOY=true in your environment.
 *
 * You can also run it standalone:
 *   npm run deploy
 */
const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const config = require('./config.js');

const commands = [];
const commandFiles = fs
  .readdirSync('./commands')
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(config.token);

(async () => {
  try {
    if (config.globalDeploy) {
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      console.log(`✅ Registered ${commands.length} global slash commands.`);
    } else {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands },
      );
      console.log(`✅ Registered ${commands.length} guild slash commands (guild: ${config.guildId}).`);
    }
  } catch (error) {
    console.error('[deploy-commands] Error:', error);
  }
})();
