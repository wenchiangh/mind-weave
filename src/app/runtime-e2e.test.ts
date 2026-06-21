import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FakeEmbeddingProvider } from "../embeddings/fake.js";
import { createRuntimeFromConfigFile } from "./runtime.js";

async function createFixture(): Promise<{
  readonly configPath: string;
  readonly notesPath: string;
  readonly notePath: string;
}> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mind-weave-e2e-"));
  const notesPath = path.join(directory, "notes");
  const notePath = path.join(notesPath, "note.md");
  const configPath = path.join(directory, "mind-weave.jsonc");
  await mkdir(notesPath, { recursive: true });
  await writeFile(notePath, `# Project

Alpha planning note.
`);
  await writeFile(configPath, `{
    "sources": [
      {
        "type": "local-fs",
        "id": "notes",
        "name": "Notes",
        "rootPath": "./notes"
      }
    ],
    "embedding": {
      "provider": "openai-compatible",
      "model": "fake-query",
      "baseUrl": "https://api.openai.com/v1",
      "apiKeyEnv": "OPENAI_API_KEY",
      "dimensions": 8
    },
    "storage": {
      "type": "sqlite",
      "path": "./mind-weave.sqlite"
    },
    "mcp": {
      "enabled": true
    }
  }`);

  return {
    configPath,
    notesPath,
    notePath
  };
}

describe("runtime end-to-end core loop", () => {
  it("scans, indexes, queries, exposes MCP search, updates edits, and reconciles deletes", async () => {
    const { configPath, notePath } = await createFixture();
    const runtime = await createRuntimeFromConfigFile(configPath, {
      embeddingProvider: new FakeEmbeddingProvider({
        provider: "fake",
        model: "fake-query",
        dimensions: 8
      })
    });

    await runtime.scan();

    const firstResults = await runtime.query("Alpha planning");
    expect(firstResults[0]).toMatchObject({
      sourceId: "notes",
      sourceName: "Notes",
      uri: expect.stringContaining("note.md"),
      text: expect.stringContaining("Alpha planning note"),
      documentStatus: "indexed",
      sourceStatus: "active"
    });

    const mcpOutput = await runtime.getMcpToolHandlers().searchKnowledge({
      query: "Alpha planning",
      limit: 5
    });
    expect(mcpOutput.results[0]?.text).toContain("Alpha planning note");

    await writeFile(notePath, `# Project

Beta revised note.
`);
    await runtime.scan();
    const editedResults = await runtime.query("Beta revised");
    expect(editedResults[0]?.text).toContain("Beta revised note");

    await rm(notePath);
    await runtime.scan();
    await expect(runtime.query("Beta revised")).resolves.toEqual([]);

    await runtime.stop();
  });
});
