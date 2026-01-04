import "dotenv/config";
import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

app.listen(config.port, () => {
  console.info(`API server running on http://localhost:${config.port}`);
});
