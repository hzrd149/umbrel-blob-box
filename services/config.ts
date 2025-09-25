import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { CONFIG_DIR } from "../env.ts";

export type AppConfig = {
  /** Whitelist of pubkeys to allow uploads from */
  whitelist: string[];
  /** Maximum file size allowed for uploads (in bytes) */
  maxFileSize?: number;
  /** Whether to allow anonymous uploads */
  allowAnonymous?: boolean;
};

const DEFAULT_CONFIG: AppConfig = {
  whitelist: [],
  maxFileSize: 100 * 1024 * 1024, // 100MB default
  allowAnonymous: false,
};

export class ConfigService {
  private config: AppConfig;
  private configFile: string;
  private configDir: string;

  constructor(configDir: string) {
    this.configDir = configDir;
    this.configFile = join(configDir, "app-config.json");
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Initialize the config service - loads existing config or creates default
   */
  async initialize(): Promise<void> {
    try {
      // Ensure config directory exists
      if (!existsSync(this.configDir)) {
        await mkdir(this.configDir, { recursive: true });
        console.info(`Created config directory: ${this.configDir}`);
      }

      // Load existing config or create default
      if (existsSync(this.configFile)) {
        await this.loadConfig();
        console.info(`Loaded configuration from: ${this.configFile}`);
      } else {
        await this.createDefaultConfig();
        console.info(`Created default configuration at: ${this.configFile}`);
      }
    } catch (error) {
      console.error("Error initializing config service:", error);
      // Fall back to default config in memory
      this.config = { ...DEFAULT_CONFIG };
      throw error;
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfig(): Promise<void> {
    try {
      const content = await readFile(this.configFile, "utf-8");
      const loadedConfig = JSON.parse(content) as Partial<AppConfig>;

      // Merge with defaults to ensure all required fields are present
      this.config = {
        ...DEFAULT_CONFIG,
        ...loadedConfig,
      };

      // Validate the loaded config
      this.validateConfig();
    } catch (error) {
      console.error("Error loading config file:", error);
      console.info("Using default configuration");
      this.config = { ...DEFAULT_CONFIG };
      // Save the default config to fix the corrupted file
      await this.saveConfig();
    }
  }

  /**
   * Create default configuration file
   */
  private async createDefaultConfig(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.saveConfig();
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    // Ensure whitelist is an array
    if (!Array.isArray(this.config.whitelist)) {
      console.warn("Invalid whitelist format, resetting to empty array");
      this.config.whitelist = [];
    }

    // Ensure maxFileSize is a positive number if provided
    if (
      this.config.maxFileSize !== undefined &&
      (typeof this.config.maxFileSize !== "number" ||
        this.config.maxFileSize <= 0)
    ) {
      console.warn("Invalid maxFileSize, using default");
      this.config.maxFileSize = DEFAULT_CONFIG.maxFileSize;
    }

    // Ensure allowAnonymous is a boolean if provided
    if (
      this.config.allowAnonymous !== undefined &&
      typeof this.config.allowAnonymous !== "boolean"
    ) {
      console.warn("Invalid allowAnonymous value, using default");
      this.config.allowAnonymous = DEFAULT_CONFIG.allowAnonymous;
    }
  }

  /**
   * Save current configuration to file
   */
  async saveConfig(): Promise<void> {
    try {
      // Ensure directory exists
      if (!existsSync(this.configDir)) {
        await mkdir(this.configDir, { recursive: true });
      }

      const content = JSON.stringify(this.config, null, 2);
      await writeFile(this.configFile, content, "utf-8");
      console.info("Configuration saved successfully");
    } catch (error) {
      console.error("Error saving config file:", error);
      throw error;
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<AppConfig> {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * Update configuration values
   */
  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    // Create updated config
    const newConfig = {
      ...this.config,
      ...updates,
    };

    // Temporarily set the new config for validation
    const oldConfig = this.config;
    this.config = newConfig;

    try {
      this.validateConfig();
      await this.saveConfig();
      console.info("Configuration updated successfully");
    } catch (error) {
      // Rollback on error
      this.config = oldConfig;
      console.error("Error updating configuration:", error);
      throw error;
    }
  }

  /**
   * Add a pubkey to the whitelist
   */
  async addToWhitelist(pubkey: string): Promise<void> {
    if (!this.config.whitelist.includes(pubkey)) {
      const newWhitelist = [...this.config.whitelist, pubkey];
      await this.updateConfig({ whitelist: newWhitelist });
    }
  }

  /**
   * Remove a pubkey from the whitelist
   */
  async removeFromWhitelist(pubkey: string): Promise<void> {
    const newWhitelist = this.config.whitelist.filter((key) => key !== pubkey);
    if (newWhitelist.length !== this.config.whitelist.length) {
      await this.updateConfig({ whitelist: newWhitelist });
    }
  }

  /**
   * Check if a pubkey is whitelisted
   */
  isWhitelisted(pubkey: string): boolean {
    return this.config.whitelist.includes(pubkey);
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.saveConfig();
    console.info("Configuration reset to defaults");
  }

  /**
   * Get the config file path
   */
  getConfigFilePath(): string {
    return this.configFile;
  }

  /**
   * Reload configuration from file
   */
  async reloadConfig(): Promise<void> {
    await this.loadConfig();
    console.info("Configuration reloaded from file");
  }
}

// Export a singleton instance
const appConfig = new ConfigService(CONFIG_DIR);

export default appConfig;
