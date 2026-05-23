import { REST, Routes } from "discord.js";

import { Commands } from "@/bot/commands/Commands";
import { env } from "@/config/Env";

const commands = new Commands();
const commandJsons = commands.getDefinitions().map((d) => d.data.toJSON());

console.log(`\nPreparando ${commandJsons.length} comandos:`);
for (const def of commands.getDefinitions()) {
    console.log(`  /${def.data.name}`);
}

const rest = new REST().setToken(env.DISCORD_TOKEN);

console.log(`\nRegistrando no Discord (guild: ${env.DISCORD_GUILD_ID})...`);

const data = (await rest.put(
    Routes.applicationGuildCommands(
        env.DISCORD_CLIENT_ID,
        env.DISCORD_GUILD_ID,
    ),
    { body: commandJsons },
)) as Array<{ name: string }>;

console.log(`\n✅ ${data.length} comandos registrados:`);
for (const cmd of data) {
    console.log(`  /${cmd.name}`);
}
