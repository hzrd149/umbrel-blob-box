import { APP_PASSWORD } from "./env";
import adminRoutes from "./routes/admin/admin.tsx";
import blossomRoutes from "./routes/blossom/index.ts";
import fileBrowserRoutes from "./routes/browser/index.tsx";
import appConfig from "./services/config.ts";
import blobStorage from "./services/storage.ts";

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
    ...blossomRoutes,
    ...fileBrowserRoutes,
  },
});

console.log(`Blossom server running on http://localhost:${server.port}`);
console.log(`Serving blobs from: ${blobStorage.getBlobDir()}`);

// Warn the user if no password is set for admin dashboard
if (!APP_PASSWORD) console.error("No password set for admin dashboard!");

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
