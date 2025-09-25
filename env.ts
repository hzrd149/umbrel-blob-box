import { join } from "path";
import crypto from "crypto";

const DATA_DIR = process.env.DATA_DIR || "./data";

export const BLOB_DIR =
  process.env.BLOB_DIR || join(DATA_DIR, "blobs") || "./data/blobs";
export const CONFIG_DIR =
  process.env.CONFIG_DIR || join(DATA_DIR, "config") || "./data/config";

/** The URL of the tor hidden service */
export const APP_HIDDEN_SERVICE = process.env.APP_HIDDEN_SERVICE
  ? "http://" + process.env.APP_HIDDEN_SERVICE
  : undefined;

/** Override default admin username */
export const APP_USERNAME = process.env.APP_USERNAME || "admin";

/** Password for accessing the admin dashboard */
export const APP_PASSWORD = process.env.APP_PASSWORD;
