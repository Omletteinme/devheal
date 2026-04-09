import { DevHealPlugin } from "../types.js";
import * as p from "@clack/prompts";
import chalk from "chalk";

const mockRustPlugin: DevHealPlugin = {
  name: "rust",
  scan: async (cwd: string) => {
    return { hasCargo: true };
  },
  rules: (data: any) => {
    return [
      {
        ruleId: "rust-target-dir-large",
        title: "Large target directory (Rust)",
        description: "The rust build `target/` directory is taking up significant space.",
        severity: "info",
        fixable: true,
        fix: { type: "shell", cmd: "cargo clean" }
      }
    ];
  }
};

const AvailablePlugins: Record<string, DevHealPlugin> = {
  rust: mockRustPlugin
};

export async function loadPlugin(pluginName: string): Promise<DevHealPlugin | null> {
  const plugin = AvailablePlugins[pluginName];
  if (!plugin) {
    p.log.warn(`Plugin ${chalk.cyan(pluginName)} could not be found.`);
    return null;
  }
  return plugin;
}
