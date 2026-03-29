import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = resolve(".");
const distDir = join(rootDir, "dist");
const manifestPath = join(rootDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const packageDir = join(distDir, `youtube-focus-clean-v${manifest.version}`);
const zipPath = join(distDir, `youtube-focus-clean-v${manifest.version}.zip`);

const extensionEntries = [
  "assets",
  "background.js",
  "content.css",
  "content.js",
  "icons",
  "manifest.json",
  "popup.html",
  "script.js",
  "shared.js",
  "styles.css"
];

rmSync(distDir, { force: true, recursive: true });
mkdirSync(packageDir, { recursive: true });

for (const entry of extensionEntries) {
  cpSync(join(rootDir, entry), join(packageDir, entry), { recursive: true });
}

writeFileSync(
  join(distDir, "release-metadata.json"),
  JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      generatedAt: new Date().toISOString(),
      artifact: zipPath,
      uploadTarget: "Chrome Web Store"
    },
    null,
    2
  )
);

if (process.platform === "win32") {
  if (existsSync(zipPath)) {
    rmSync(zipPath, { force: true });
  }

  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${packageDir}\\*' -DestinationPath '${zipPath}' -Force`
    ],
    {
      stdio: "inherit"
    }
  );
} else {
  execFileSync("zip", ["-r", zipPath, "."], {
    cwd: packageDir,
    stdio: "inherit"
  });
}
