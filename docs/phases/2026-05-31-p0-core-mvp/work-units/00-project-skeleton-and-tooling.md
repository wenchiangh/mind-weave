# Project Skeleton and Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the minimal TypeScript project foundation needed for future MindWeave Core work units.

**Architecture:** This work unit creates the Node.js/TypeScript runtime shell without implementing domain capabilities. The CLI is introduced only as an adapter over a tiny app runtime health function, preserving the Core-first boundary for later work.

**Tech Stack:** Node.js, pnpm, TypeScript 7 beta native preview (`tsgo`), tsx, Vitest.

---

## Files

- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/app/runtime.ts`
- Create: `src/app/runtime.test.ts`
- Create: `src/interfaces/cli/main.ts`
- Create: `src/interfaces/cli/main.test.ts`
- Create: `src/index.ts`
- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`

## Constraints

- Do not implement config loading.
- Do not implement source scanning.
- Do not implement storage, embeddings, query, MCP, or watchers.
- Do not add Tauri or desktop UI dependencies.
- Keep CLI behavior as an adapter over app/runtime functions.
- Use TypeScript 7 beta native preview for typechecking because P0 starts close to the TypeScript 7 stable release window.
- Do not depend on TypeScript compiler APIs in P0 tooling.
- When TypeScript 7 becomes stable in the `typescript` package, replace `@typescript/native-preview@beta` with `typescript@latest` and keep the typecheck command aligned with the official stable CLI.

## Task 1: Add pnpm and TypeScript Tooling

**Files:**

- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

Create:

```json
{
  "name": "mind-weave",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsgo --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "tsx src/interfaces/cli/main.ts"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Pin latest pnpm with Corepack**

Run:

```bash
corepack use pnpm@latest
```

Expected:

```text
package.json is updated with a packageManager field for the resolved latest pnpm version
```

- [ ] **Step 3: Create `tsconfig.json`**

Create:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node", "vitest/globals"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

Create:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
```

- [ ] **Step 5: Add TypeScript 7 beta and latest development dependencies**

Run:

```bash
pnpm add -D @typescript/native-preview@beta tsx@latest vitest@latest @types/node@latest
```

Expected:

```text
pnpm add exits with code 0
```

`pnpm-lock.yaml` should be created.
`package.json` should contain `devDependencies` with resolved current versions.

- [ ] **Step 6: Run typecheck after tooling config exists**

Run:

```bash
pnpm typecheck
```

Expected:

```text
tsgo --noEmit
```

The command exits with code 0. At this point `vitest.config.ts` is the only TypeScript input.

## Task 2: Add Minimal Runtime Health Function

**Files:**

- Create: `src/app/runtime.ts`
- Create: `src/app/runtime.test.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Write runtime test**

Create `src/app/runtime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getRuntimeHealth } from "./runtime.js";

describe("getRuntimeHealth", () => {
  it("returns a stable runtime health payload", () => {
    expect(getRuntimeHealth()).toEqual({
      name: "mind-weave-core",
      status: "ok"
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- src/app/runtime.test.ts
```

Expected:

```text
FAIL src/app/runtime.test.ts
Cannot find module './runtime.js'
```

- [ ] **Step 3: Implement runtime health function**

Create `src/app/runtime.ts`:

```ts
export type RuntimeHealth = {
  name: "mind-weave-core";
  status: "ok";
};

export function getRuntimeHealth(): RuntimeHealth {
  return {
    name: "mind-weave-core",
    status: "ok"
  };
}
```

- [ ] **Step 4: Add public package entry**

Create `src/index.ts`:

```ts
export { getRuntimeHealth } from "./app/runtime.js";
export type { RuntimeHealth } from "./app/runtime.js";
```

- [ ] **Step 5: Run runtime test**

Run:

```bash
pnpm test -- src/app/runtime.test.ts
```

Expected:

```text
PASS src/app/runtime.test.ts
```

## Task 3: Add Minimal CLI Adapter

**Files:**

- Create: `src/interfaces/cli/main.ts`
- Create: `src/interfaces/cli/main.test.ts`

- [ ] **Step 1: Write CLI adapter tests**

Create `src/interfaces/cli/main.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runCli } from "./main.js";

describe("runCli", () => {
  it("prints runtime health as JSON", () => {
    const writes: string[] = [];
    const exitCode = runCli(["health"], {
      write: (value) => writes.push(value)
    });

    expect(exitCode).toBe(0);
    expect(writes).toEqual([
      "{\"name\":\"mind-weave-core\",\"status\":\"ok\"}\n"
    ]);
  });

  it("prints usage for unknown commands", () => {
    const writes: string[] = [];
    const exitCode = runCli(["unknown"], {
      write: (value) => writes.push(value)
    });

    expect(exitCode).toBe(1);
    expect(writes).toEqual([
      "Usage: mindweave health\n"
    ]);
  });
});
```

- [ ] **Step 2: Run CLI tests to verify they fail**

Run:

```bash
pnpm test -- src/interfaces/cli/main.test.ts
```

Expected:

```text
FAIL src/interfaces/cli/main.test.ts
Cannot find module './main.js'
```

- [ ] **Step 3: Implement CLI adapter**

Create `src/interfaces/cli/main.ts`:

```ts
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
```

- [ ] **Step 4: Run CLI tests**

Run:

```bash
pnpm test -- src/interfaces/cli/main.test.ts
```

Expected:

```text
PASS src/interfaces/cli/main.test.ts
```

- [ ] **Step 5: Run CLI health command**

Run:

```bash
pnpm cli health
```

Expected:

```json
{"name":"mind-weave-core","status":"ok"}
```

## Task 4: Run Full Validation

**Files:**

- No new files.

- [ ] **Step 1: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected:

```text
tsgo --noEmit
```

The command exits with code 0.

- [ ] **Step 2: Run all tests**

Run:

```bash
pnpm test
```

Expected:

```text
PASS src/app/runtime.test.ts
PASS src/interfaces/cli/main.test.ts
```

The command exits with code 0.

- [ ] **Step 3: Check git diff**

Run:

```bash
git status --short
```

Expected changed files include:

```text
?? package.json
?? pnpm-lock.yaml
?? tsconfig.json
?? vitest.config.ts
?? src/app/runtime.ts
?? src/app/runtime.test.ts
?? src/index.ts
?? src/interfaces/cli/main.ts
?? src/interfaces/cli/main.test.ts
```

## Task 5: Update Execution Index and Commit

**Files:**

- Modify: `docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md`

- [ ] **Step 1: Mark WU-00 as testing during validation**

Change the WU-00 status line to:

```markdown
- [ ] Status: `testing`
```

- [ ] **Step 2: After validation passes, mark WU-00 as passed**

Change the WU-00 status line to:

```markdown
- [x] Status: `passed`
```

- [ ] **Step 3: Run final validation after status update**

Run:

```bash
pnpm typecheck
pnpm test
```

Expected:

```text
typecheck exits with code 0
test exits with code 0
```

- [ ] **Step 4: Commit the work unit**

Run:

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts src docs/phases/2026-05-31-p0-core-mvp/04_execution_index.md
git commit -m "chore: add project skeleton and tooling"
```

Expected:

```text
Commit succeeds with message: chore: add project skeleton and tooling
```

## Recovery Notes

If execution is interrupted:

- If only `package.json`, `tsconfig.json`, and `vitest.config.ts` exist, resume at Task 1 Step 5.
- If runtime tests exist but `src/app/runtime.ts` does not, resume at Task 2 Step 2.
- If CLI tests exist but `src/interfaces/cli/main.ts` does not, resume at Task 3 Step 2.
- If all files exist but validation has not run, resume at Task 4.
- If validation passed but no commit exists, resume at Task 5.

## Done Criteria

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm cli health` prints `{"name":"mind-weave-core","status":"ok"}`.
- WU-00 status in `04_execution_index.md` is marked as passed.
- Changes are committed with message `chore: add project skeleton and tooling`.

## Success Check

WU-00 is successful only if these commands all pass after the work unit commit:

```bash
pnpm typecheck
pnpm test
pnpm cli health
```

Expected observable output:

```text
typecheck exits with code 0
test exits with code 0
CLI prints {"name":"mind-weave-core","status":"ok"}
```
