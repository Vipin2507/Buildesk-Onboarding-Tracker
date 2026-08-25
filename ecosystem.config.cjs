/**
 * PM2 process definition — always inject production .env (especially DATABASE_URL).
 * Usage from APP_DIR: pm2 start ecosystem.config.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const APP_DIR =
  process.env.APP_DIR || "/home/buildesk-track/htdocs/track.cravingcodetech.in";
const PM2_NAME = process.env.PM2_NAME || "buildesk-compass";

function parseDotEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const fileEnv = parseDotEnv(path.join(APP_DIR, ".env"));

module.exports = {
  apps: [
    {
      name: PM2_NAME,
      script: ".output/server/index.mjs",
      cwd: APP_DIR,
      env: {
        ...fileEnv,
        ...process.env,
      },
    },
  ],
};
