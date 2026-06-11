import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { initSockets } from "./sockets/index.js";
import { ensureSeedData } from "./config/bootstrap.js";

const httpServer = createServer(app);
initSockets(httpServer);

await ensureSeedData();
httpServer.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
