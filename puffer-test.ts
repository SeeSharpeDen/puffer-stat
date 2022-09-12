import { do_embed, get_server, get_server_data, get_server_log, post_command, Server, servers } from "./src/server.ts";

try {
    // A server.
    const server = servers[0];

    console.log(await do_embed(server));
    
    // // Get server details from puffer
    // let detail = await get_server(server);
    // console.log(detail);

    // // Get the server data/settings
    // let settings = await get_server_data(server);
    // // console.log(settings);

    // let epoc = Math.floor(Date.now() / 1000) - 1;

    // await post_command(server, "status");

    // // Get the log from the server.
    // let log = await get_server_log(server, epoc);
    // console.log(log);
    
} catch (error) {
    console.error(error);
}

