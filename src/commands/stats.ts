import { ApplicationCommandTypes, InteractionResponseTypes } from "../../deps.ts";
import { servers } from "../server.ts";
import { createCommand } from "./mod.ts";

createCommand({
    name: "pstat",
    description: "Show the status of puffer",
    type: ApplicationCommandTypes.ChatInput,
    scope: "Global",
    execute: async (bot, interaction) => {

        // Get all the unique hosts from the servers file.
        let hosts: Array<string> = [];
        servers.forEach((server) => {
            let url = new URL(server.puffer);
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
                    content: `🐡 ${servers.length} servers on ${hosts.length} instances.`,
                },
            },
        );
    },
});
