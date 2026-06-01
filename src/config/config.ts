import type { EffectiveConfig } from "./contracts.js";
import { createEffectiveConfig } from "./effective.js";
import { loadConfigFile } from "./load.js";
import { validateUserConfig } from "./validate.js";

export async function loadEffectiveConfigFile(
  filePath: string
): Promise<EffectiveConfig> {
  const parsed = await loadConfigFile(filePath);
  const userConfig = validateUserConfig(parsed.data);
  return createEffectiveConfig(userConfig, {
    baseDir: parsed.baseDir
  });
}
