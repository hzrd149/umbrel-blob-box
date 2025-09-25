import { join } from "path";

const DATA_DIR = process.env.DATA_DIR || "./data";

export const BLOB_DIR =
  process.env.BLOB_DIR || join(DATA_DIR, "blobs") || "./data/blobs";
export const CACHE_DIR =
  process.env.CACHE_DIR || join(DATA_DIR, "cache") || "./data/cache";

/** The URL of the tor hidden service */
export const APP_HIDDEN_SERVICE = process.env.APP_HIDDEN_SERVICE;
