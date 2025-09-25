import blobStorage from "./services/storage.ts";
import appConfig from "./services/config.ts";
import { handleBlossomRequest } from "./routes/blossom/index.ts";
import { withCors } from "./utils/cors.ts";
import fileBrowser from "./routes/browser/index.tsx";
import adminRoutes from "./routes/admin/admin.tsx";

// Initialize services
console.log("Starting Blossom server...");

// Initialize configuration service
try {
  await appConfig.initialize();
  console.log("Configuration service initialized successfully");
} catch (error) {
  console.error("Failed to initialize configuration service:", error);
  console.log("Continuing with default configuration...");
}

// Start the storage service
blobStorage.start();

const server = Bun.serve({
  port: process.env.PORT || 3000,
  routes: {
    "/styles.css": Bun.file("./public/styles.css"),
    ...adminRoutes,
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
