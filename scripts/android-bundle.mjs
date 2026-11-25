import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const result = spawnSync(gradle, ["bundleRelease"], {
  cwd: path.join(root, "android"),
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
