import { readFile } from "node:fs/promises";

const forbiddenRegistryUrl =
  "https://artifactory.allegrogroup.com/artifactory/api/npm/group-npm";
const packageLock = await readFile(new URL("../package-lock.json", import.meta.url), "utf8");

if (packageLock.includes(forbiddenRegistryUrl)) {
  console.error(`Forbidden registry URL found in package-lock.json: ${forbiddenRegistryUrl}`);
  process.exitCode = 1;
}