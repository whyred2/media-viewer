import fs from "fs-extra";
import path from "path";

export interface AppConfig {
  rootDirectory: string | null;
}

// A separate profile also allows testing without changing the user's gallery.
const CONFIG_FILE = path.resolve(process.env.LOCAL_GALLERY_CONFIG || "config.json");

const defaultConfig: AppConfig = {
  rootDirectory: null,
};

export async function getConfig(): Promise<AppConfig> {
  try {
    if (await fs.pathExists(CONFIG_FILE)) {
      const config = await fs.readJson(CONFIG_FILE);
      return {
        rootDirectory:
          typeof config?.rootDirectory === "string" && path.isAbsolute(config.rootDirectory)
            ? config.rootDirectory
            : null,
      };
    }
  } catch (error) {
    console.error("Error reading config:", error);
  }
  return defaultConfig;
}

export async function setConfig(
  config: Partial<AppConfig>
): Promise<AppConfig> {
  try {
    const currentConfig = await getConfig();
    const newConfig = { ...currentConfig, ...config };
    await fs.writeJson(CONFIG_FILE, newConfig, { spaces: 2 });
    return newConfig;
  } catch (error) {
    console.error("Error writing config:", error);
    throw error;
  }
}

export async function validatePath(dirPath: string): Promise<boolean> {
  try {
    if (!path.isAbsolute(dirPath)) return false;
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
