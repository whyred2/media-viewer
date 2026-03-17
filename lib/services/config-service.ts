import fs from "fs-extra";
import path from "path";

export interface AppConfig {
  rootDirectory: string | null;
}

const CONFIG_FILE = path.join(process.cwd(), "config.json");

const defaultConfig: AppConfig = {
  rootDirectory: null,
};

export async function getConfig(): Promise<AppConfig> {
  try {
    if (await fs.pathExists(CONFIG_FILE)) {
      const config = await fs.readJson(CONFIG_FILE);
      return { ...defaultConfig, ...config };
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
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
