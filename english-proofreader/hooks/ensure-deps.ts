#!/usr/bin/env bun

import { existsSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";

const pluginRoot = dirname(import.meta.dir);
const nodeModulesPath = join(pluginRoot, "node_modules");

if (!existsSync(nodeModulesPath)) {
  console.error("Installing english-proofreader dependencies...");
  try {
    execSync("bun install", {
      cwd: pluginRoot,
      stdio: "inherit",
    });
    console.error("Dependencies installed successfully.");
  } catch (error) {
    console.error("Failed to install dependencies:", (error as Error).message);
  }
}

// Output empty JSON to indicate success
console.log(JSON.stringify({}));
