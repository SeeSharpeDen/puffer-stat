import { ApplicationCommandTypes, InteractionResponseTypes, transformEmbed } from "../../deps.ts";
import { do_embed, servers, transform_embed } from "../server.ts";
import { createCommand } from "./mod.ts";

createCommand({
    name: "status",
    description: "Shows the status of all servers",
    type: ApplicationCommandTypes.ChatInput,
    scope: "Global",
    execute: async (bot, interaction) => {
        let embeds = [];
        for (const server of servers) {
            try {
                embeds.push(await do_embed(server));   
            } catch (error) {
                console.log(`Error with ${server.server_url}: ${error.toString()}`);
                console.error(error);
            }
        }
        await bot.helpers.sendInteractionResponse(
            interaction.id,
            interaction.token,
            {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: {
                    embeds: embeds,
                },
            },
        );
    },
});
