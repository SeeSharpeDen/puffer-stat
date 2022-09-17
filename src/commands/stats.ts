import { ApplicationCommandTypes, InteractionResponseTypes } from "../../deps.ts";
import { game_servers } from "../server.ts";
import { createCommand } from "./mod.ts";

createCommand({
    name: "pstat",
    description: "Show the status of puffer",
    type: ApplicationCommandTypes.ChatInput,
    scope: "Global",
    execute: async (bot, interaction) => {

        // Get all the unique hosts from the servers file.
        let hosts: Array<string> = [];
        game_servers.forEach((gs) => {
            let url = new URL(gs.server.url);
            if (!hosts.includes(url.host)) {
                hosts.push(url.host);
            }
        });

        await bot.helpers.sendInteractionResponse(
            interaction.id,
            interaction.token,
            {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: {
                    content: `🐡 ${game_servers.length} servers on ${hosts.length} instances.`,
                },
            },
        );
    },
});
