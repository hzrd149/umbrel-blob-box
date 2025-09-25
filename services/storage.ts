import { watch, readdir, stat, readFile, writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";
import { join, relative } from "path";
import { existsSync } from "fs";
import { BLOB_DIR, CACHE_DIR } from "../env.ts";
import debug from "debug";

const log = debug("storage");

interface FileHashCache {
  [filePath: string]: {
    hash: string;
    mtime: number;
    size: number;
  };
}

export class StorageService {
  private cache: FileHashCache = {};
  private cacheFile: string;
  private isWatching = false;
  private abortController: AbortController | null = null;
  private blobDir: string;

  constructor(blobDir: string, cacheDir: string) {
    this.blobDir = blobDir;
    this.cacheFile = join(cacheDir, "blobs.json");
  }

  /**
   * Calculate SHA256 hash of a file
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Get file stats (mtime and size)
   */
  private async getFileStats(
    filePath: string,
  ): Promise<{ mtime: number; size: number }> {
    const stats = await stat(filePath);
    return {
      mtime: stats.mtime.getTime(),
      size: stats.size,
    };
  }

  /**
   * Load cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      if (existsSync(this.cacheFile)) {
        const content = await readFile(this.cacheFile, "utf-8");
        this.cache = JSON.parse(content);
        log(`Loaded cache with ${Object.keys(this.cache).length} entries`);
      } else {
        log("No existing cache found, starting fresh");
        this.cache = {};
      }
    } catch (error) {
      log("Error loading cache:", error);
      this.cache = {};
    }
  }

  /**
   * Save cache to disk
   */
  private async saveCache(): Promise<void> {
    try {
      // Ensure cache directory exists
      await mkdir(CACHE_DIR, { recursive: true });

      const content = JSON.stringify(this.cache, null, 2);
      await writeFile(this.cacheFile, content, "utf-8");
      log(`Saved cache with ${Object.keys(this.cache).length} entries`);
    } catch (error) {
      log("Error saving cache:", error);
      throw error;
    }
  }

  /**
   * Process a single file and update cache if needed
   */
  private async processFile(filePath: string): Promise<boolean> {
    try {
      const stats = await this.getFileStats(filePath);
      const relativePath = relative(this.blobDir, filePath);
      const cached = this.cache[relativePath];

      // Check if file has changed or is new
      if (
        !cached ||
        cached.mtime !== stats.mtime ||
        cached.size !== stats.size
      ) {
        log(`Processing file: ${relativePath}`);
        const hash = await this.calculateFileHash(filePath);

        this.cache[relativePath] = {
          hash,
          mtime: stats.mtime,
          size: stats.size,
        };

        return true; // File was updated
      }

      return false; // File unchanged
    } catch (error) {
      log(`Error processing file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Recursively scan directory for files
   */
  private async scanDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      log(`Error scanning directory ${dirPath}:`, error);
    }

    return files;
  }

  /**
   * Perform initial scan of all files
   */
  private async initialScan(): Promise<void> {
    log(`Starting initial scan of ${this.blobDir}`);

    if (!existsSync(this.blobDir)) {
      log(`BLOB_DIR ${this.blobDir} does not exist, creating it`);
      await mkdir(this.blobDir, { recursive: true });
      return;
    }

    const files = await this.scanDirectory(this.blobDir);
    log(`Found ${files.length} files to process`);

    let updatedCount = 0;
    for (const file of files) {
      const updated = await this.processFile(file);
      if (updated) updatedCount++;
    }

    // Remove entries for files that no longer exist
    const currentFiles = new Set(files.map((f) => relative(this.blobDir, f)));
    const cachedFiles = Object.keys(this.cache);
    let removedCount = 0;

    for (const cachedFile of cachedFiles) {
      if (!currentFiles.has(cachedFile)) {
        delete this.cache[cachedFile];
        removedCount++;
      }
    }

    if (updatedCount > 0 || removedCount > 0) {
      await this.saveCache();
    }

    log(
      `Initial scan complete: ${updatedCount} files updated, ${removedCount} files removed`,
    );
  }

  /**
   * Handle file system events
   */
  private async handleFileChange(
    eventType: string,
    filename: string | null,
  ): Promise<void> {
    if (!filename) return;

    const fullPath = join(this.blobDir, filename);
    const relativePath = relative(this.blobDir, filename);

    log(`File change detected: ${eventType} - ${relativePath}`);

    try {
      if (existsSync(fullPath)) {
        const stats = await stat(fullPath);
        if (stats.isFile()) {
          const updated = await this.processFile(fullPath);
          if (updated) {
            await this.saveCache();
          }
        }
      } else {
        // File was deleted
        if (this.cache[relativePath]) {
          delete this.cache[relativePath];
          await this.saveCache();
          log(`Removed deleted file from cache: ${relativePath}`);
        }
      }
    } catch (error) {
      log(`Error handling file change for ${filename}:`, error);
    }
  }

  /**
   * Start the file watching service
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      log("Storage service is already running");
      return;
    }

    log("Starting storage service...");

    // Load existing cache
    await this.loadCache();

    // Perform initial scan
    await this.initialScan();

    // Set up file watching
    this.abortController = new AbortController();
    this.isWatching = true;

    try {
      // Ensure blob directory exists
      if (!existsSync(this.blobDir)) {
        await mkdir(this.blobDir, { recursive: true });
      }

      // Start watching for changes
      const watcher = watch(this.blobDir, {
        recursive: true,
        signal: this.abortController.signal,
      });

      log(`Watching for changes in ${this.blobDir}`);

      for await (const event of watcher) {
        await this.handleFileChange(event.eventType, event.filename);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        log("Error in file watcher:", error);
        throw error;
      }
    } finally {
      this.isWatching = false;
      log("File watching stopped");
    }
  }

  /**
   * Stop the file watching service
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isWatching = false;
    log("Storage service stopped");
  }

  /**
   * Get the hash of a specific file
   */
  getFileHash(relativePath: string): string | null {
    return this.cache[relativePath]?.hash || null;
  }

  /**
   * Get all cached file hashes
   */
  getAllHashes(): FileHashCache {
    return { ...this.cache };
  }

  /**
   * Check if service is currently watching
   */
  isRunning(): boolean {
    return this.isWatching;
  }

  /**
   * Force refresh of a specific file
   */
  async refreshFile(relativePath: string): Promise<void> {
    const fullPath = join(this.blobDir, relativePath);
    if (existsSync(fullPath)) {
      const updated = await this.processFile(fullPath);
      if (updated) {
        await this.saveCache();
      }
    }
  }

  /**
   * Force refresh of all files
   */
  async refreshAll(): Promise<void> {
    await this.initialScan();
  }

  /**
   * Get the current blob directory path
   */
  getBlobDir(): string {
    return this.blobDir;
  }
}

// Export a singleton instance
const blobStorage = new StorageService(BLOB_DIR, CACHE_DIR);

export default blobStorage;
