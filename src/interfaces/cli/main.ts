import { fileURLToPath } from "node:url";
import { getRuntimeHealth } from "../../app/runtime.js";

export type CliIO = {
  write: (value: string) => void;
};

export function runCli(args: string[], io: CliIO): number {
  const [command] = args;

  if (command === "health") {
    io.write(`${JSON.stringify(getRuntimeHealth())}\n`);
    return 0;
  }

  io.write("Usage: mindweave health\n");
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const exitCode = runCli(process.argv.slice(2), {
    write: (value) => process.stdout.write(value)
  });

  process.exitCode = exitCode;
}
