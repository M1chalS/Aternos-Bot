import { Client, GatewayIntentBits } from "discord.js";
import * as Aternos from "./aternos-api";

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.DISCORD_TOKEN;

const ATERNOS_USER = process.env.ATERNOS_USERNAME || "";
const ATERNOS_PASS = process.env.ATERNOS_PASSWORD || "";

client.on("messageCreate", async (message: any) => {
    if (message.content === "!start") {

        await message.reply("🚀 Uruchamiam serwer...");

        try {
            const cookies = await Aternos.loginToAternos(ATERNOS_USER, ATERNOS_PASS);

            const { servers } = await Aternos.getServerList(cookies);

            if (!servers || servers.length === 0 || !servers[0]?.id) {
                await message.reply("❌ Nie znaleziono serwera.");
                return;
            }

            const serverId = servers[0].id;

            const result = await Aternos.manageServer(cookies, serverId, "start");

            if (result.success) {
                await message.reply("✅ Serwer się uruchamia!");
            } else {
                console.log(result.message);
                await message.reply("❌ Nie udało się uruchomić serwera.");
            }
        } catch (err) {
            console.log(err);
            await message.reply("❌ Nie udało się uruchomić serwera.");
        }
    }
});

client.login(TOKEN);