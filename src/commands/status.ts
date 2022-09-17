import { ApplicationCommandTypes, InteractionResponseTypes, transformEmbed } from "../../deps.ts";
import { do_embed, game_servers, transform_embed } from "../server.ts";
import { createCommand } from "./mod.ts";

createCommand({
    name: "status",
    description: "Shows the status of all servers",
    type: ApplicationCommandTypes.ChatInput,
    scope: "Global",
    execute: async (bot, interaction) => {
        let embeds = [];
        for (const server of game_servers) {
            try {
                let embed = await do_embed(server);
                // embeds.push(transform_embed(embed));
                embeds.push(embed);
            } catch (error) {
                console.log(`Error with ${server.server.url}: ${error.toString()}`);
                console.error(error);
            }
        }
        console.log(embeds);
        
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
