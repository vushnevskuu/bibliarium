import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ext = join(root, "extension");
const outDir = join(root, "public");
const outFile = join(outDir, "bibliarium-extension.zip");

if (!existsSync(ext)) {
  console.error("Missing extension/ folder");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
execSync(`cd "${ext}" && zip -r "${outFile}" . -x "*.DS_Store"`, {
  stdio: "inherit",
});
console.log("Wrote", outFile);
