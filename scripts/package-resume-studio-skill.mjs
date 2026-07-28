import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const skillDirectory = resolve(root, "skills/resume-studio");
const output = resolve(root, "public/downloads/resume-studio-skill.zip");

await mkdir(dirname(output), { recursive: true });
await rm(output, { force: true });

await new Promise((resolvePromise, reject) => {
  const child = spawn(
    "zip",
    ["-X", "-q", "-r", output, "SKILL.md", "agents", "references"],
    { cwd: skillDirectory, stdio: "inherit" },
  );

  child.once("error", reject);
  child.once("exit", (code) => {
    if (code === 0) {
      resolvePromise();
      return;
    }
    reject(new Error(`zip exited with code ${code}`));
  });
});

console.log(`Packaged Resume Studio skill at ${output}`);
