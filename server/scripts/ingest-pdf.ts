import { copyFile, mkdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

async function main() {
  const source = process.argv[2];
  if (!source) {
    throw new Error("Usage: npm run ingest:pdf -- \"C:/path/to/file.pdf\"");
  }

  const sourcePath = resolve(source);
  const targetDir = resolve("knowledge");
  const targetPath = resolve(targetDir, basename(sourcePath));

  await mkdir(targetDir, { recursive: true });
  await copyFile(sourcePath, targetPath);

  console.log(`Copied PDF to ${targetPath}`);
  console.log("Set KNOWLEDGE_PDF_PATH if you want the server to use this local copy.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
