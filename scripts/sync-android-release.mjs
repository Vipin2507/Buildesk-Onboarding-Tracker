import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apkPath = path.join(root, "public", "downloads", "trackdesk.apk");
const releasePath = path.join(root, "public", "native-release.json");
const publicApkPath = "/downloads/trackdesk.apk";

function unzipEntry(buf, name) {
  const sig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  let offset = 0;
  while (offset < buf.length) {
    const start = buf.indexOf(sig, offset);
    if (start < 0) return null;
    const flags = buf.readUInt16LE(start + 6);
    const method = buf.readUInt16LE(start + 8);
    let compSize = buf.readUInt32LE(start + 18);
    const nameLen = buf.readUInt16LE(start + 26);
    const extraLen = buf.readUInt16LE(start + 28);
    const fileName = buf.subarray(start + 30, start + 30 + nameLen).toString("utf8");
    const dataStart = start + 30 + nameLen + extraLen;
    if (flags & 0x08) {
      offset = dataStart;
      continue;
    }
    const data = buf.subarray(dataStart, dataStart + compSize);
    offset = dataStart + compSize;
    if (fileName !== name) continue;
    if (method === 0) return data;
    if (method === 8) return zlib.inflateRawSync(data);
    throw new Error(`Unsupported zip method ${method} for ${name}`);
  }
  return null;
}

function readStringPool(manifest) {
  const headerSize = manifest.readUInt16LE(2);
  const pool = headerSize;
  if (manifest.readUInt16LE(pool) !== 0x0001) throw new Error("APK manifest has no string pool");
  const stringCount = manifest.readUInt32LE(pool + 8);
  const flags = manifest.readUInt32LE(pool + 16);
  const stringsStart = manifest.readUInt32LE(pool + 20);
  const utf8 = (flags & 0x100) !== 0;
  const strings = [];
  for (let i = 0; i < stringCount; i += 1) {
    const rel = manifest.readUInt32LE(pool + 28 + i * 4);
    let cursor = pool + stringsStart + rel;
    if (utf8) {
      const len = () => {
        let value = manifest[cursor];
        cursor += 1;
        if (value & 0x80) {
          value = ((value & 0x7f) << 8) | manifest[cursor];
          cursor += 1;
        }
        return value;
      };
      len();
      const byteLen = len();
      strings.push(manifest.subarray(cursor, cursor + byteLen).toString("utf8"));
    } else {
      const charLen = manifest.readUInt16LE(cursor);
      strings.push(manifest.subarray(cursor + 2, cursor + 2 + charLen * 2).toString("utf16le"));
    }
  }
  return { strings, poolSize: manifest.readUInt32LE(pool + 4), poolStart: pool };
}

function readApkIdentity(manifest) {
  const { strings, poolSize, poolStart } = readStringPool(manifest);
  let offset = poolStart + poolSize;
  let versionName;
  let versionCode;
  while (offset + 8 <= manifest.length) {
    const type = manifest.readUInt16LE(offset);
    const size = manifest.readUInt32LE(offset + 4);
    if (size < 8 || offset + size > manifest.length) break;
    if (type === 0x0102) {
      const ext = offset + 16;
      const attributeStart = manifest.readUInt16LE(ext + 8);
      const attributeSize = manifest.readUInt16LE(ext + 10);
      const attributeCount = manifest.readUInt16LE(ext + 12);
      for (let i = 0; i < attributeCount; i += 1) {
        const attr = ext + attributeStart + i * attributeSize;
        const name = strings[manifest.readUInt32LE(attr + 4)];
        const raw = manifest.readUInt32LE(attr + 8);
        const dataType = manifest[attr + 15];
        const data = manifest.readUInt32LE(attr + 16);
        if (name === "versionName" && raw !== 0xffffffff) versionName = strings[raw];
        if (name === "versionCode" && dataType === 0x10) versionCode = data;
      }
    }
    offset += size;
  }
  if (!versionName || versionCode == null) {
    throw new Error("Could not read versionName and versionCode from the APK manifest");
  }
  return { versionName, versionCode };
}

if (!fs.existsSync(apkPath)) {
  console.log("No public/downloads/trackdesk.apk. Leaving native-release.json unchanged.");
  process.exit(0);
}

const apk = fs.readFileSync(apkPath);
const manifest = unzipEntry(apk, "AndroidManifest.xml");
if (!manifest) {
  console.error("trackdesk.apk does not contain AndroidManifest.xml");
  process.exit(1);
}
const identity = readApkIdentity(manifest);
const sha256 = createHash("sha256").update(apk).digest("hex");

const current = fs.existsSync(releasePath)
  ? JSON.parse(fs.readFileSync(releasePath, "utf8"))
  : {};
const android = current.android ?? {};
const next = {
  ...current,
  android: {
    ...android,
    minimumVersion: android.minimumVersion || identity.versionName,
    latestVersion: identity.versionName,
    latestVersionCode: identity.versionCode,
    apkPath: publicApkPath,
    apkSha256: sha256,
    message:
      android.message ||
      "This Android build is missing a required native update. Use Upgrade app. Android will ask you to confirm the install.",
  },
};
fs.writeFileSync(releasePath, `${JSON.stringify(next, null, 2)}\n`);
console.log(
  `Android release is ${identity.versionName} (${identity.versionCode}), sha256 ${sha256.slice(0, 12)}.`,
);
