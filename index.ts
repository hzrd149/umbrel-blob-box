import blobStorage from "./services/storage.ts";
import { handleBlossomRequest } from "./routes/blossom.ts";
import { withCors } from "./utils/cors.ts";
import fileBrowser from "./routes/browser";

// Start the storage service
console.log("Starting Blossom server...");
blobStorage.start();

const server = Bun.serve({
  port: process.env.PORT || 3000,
  routes: {
    "/styles.css": Bun.file("./public/styles.css"),
    "/:sha256(.+?)": {
      GET: withCors(handleBlossomRequest),
    },
    "/": withCors(fileBrowser),
  },
});

console.log(`Blossom server running on http://localhost:${server.port}`);
console.log(`Serving blobs from: ${blobStorage.getBlobDir()}`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  blobStorage.stop();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down server...");
  blobStorage.stop();
  server.stop();
  process.exit(0);
});
