import { REST, Routes } from 'discord.js';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { env } from '../config/env.js';
import type { Command } from './commands/Command.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsDir = join(__dirname, 'commands');

const files = readdirSync(commandsDir).filter(
    f =>
        (f.endsWith('.ts') || f.endsWith('.js'))
        && !f.endsWith('.d.ts')
        && !f.startsWith('Command'),
);

const commandJsons: object[] = [];

for (const file of files) {
    const module = await import(pathToFileURL(join(commandsDir, file)).href) as { default?: Command };
    if (module.default?.data) {
        commandJsons.push(module.default.data.toJSON());
        console.log(`Preparing: /${module.default.data.name}`);
    }
}

const rest = new REST().setToken(env.DISCORD_TOKEN);

console.log(`\nRegistering ${commandJsons.length} slash commands in Discord...`);

const data = await rest.put(
    Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
    { body: commandJsons },
) as Array<{ name: string }>;

console.log(`\n${data.length} commands registered successfully.`);
for (const cmd of data) {
    console.log(`  /${cmd.name}`);
}
