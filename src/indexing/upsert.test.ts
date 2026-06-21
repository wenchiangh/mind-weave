import { mkdtemp, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  EmbeddingInput,
  EmbeddingProvider,
  EmbeddingResult
} from "../embeddings/contracts.js";
import { FakeEmbeddingProvider } from "../embeddings/fake.js";
import { MarkdownProcessor } from "../processors/markdown.js";
import type {
  DocumentProcessor,
  ProcessableDocument,
  ProcessedChunk
} from "../processors/contracts.js";
import type { SourceCandidate } from "../sources/contracts.js";
import { SQLiteStorage } from "../storage/sqlite.js";
import { DocumentUpsertIndexer } from "./upsert.js";

async function createTempWorkspace(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "mind-weave-upsert-"));
}

async function writeMarkdownCandidate(
  directory: string,
  relativePath: string,
  content: string,
  updatedAt: number
): Promise<SourceCandidate> {
  const filePath = path.join(directory, relativePath);
  await writeFile(filePath, content);
  const fileStat = await stat(filePath);

  return {
    sourceId: "source_a",
    uri: pathToFileURL(filePath).href,
    relativePath,
    fileType: "markdown",
    updatedAt,
    size: fileStat.size
  };
}

class CountingEmbeddingProvider implements EmbeddingProvider {
  private readonly inner = new FakeEmbeddingProvider({ dimensions: 8 });
  calls: readonly EmbeddingInput[][] = [];

  getConfig() {
    return this.inner.getConfig();
  }

  async embedDocuments(inputs: readonly EmbeddingInput[]): Promise<readonly EmbeddingResult[]> {
    this.calls = [...this.calls, [...inputs]];
    return this.inner.embedDocuments(inputs);
  }

  async embedQuery(text: string) {
    return this.inner.embedQuery(text);
  }
}

class FailingProcessor implements DocumentProcessor {
  supports(): boolean {
    return true;
  }

  async process(_document: ProcessableDocument): Promise<readonly ProcessedChunk[]> {
    throw new Error("processor failed");
  }
}

function createIndexer(
  storage: SQLiteStorage,
  embeddingProvider: EmbeddingProvider,
  processors: readonly DocumentProcessor[] = [new MarkdownProcessor()]
): DocumentUpsertIndexer {
  return new DocumentUpsertIndexer({
    storage,
    processors,
    embeddingProvider
  });
}

describe("DocumentUpsertIndexer", () => {
  it("indexes a Markdown candidate into document, chunks, embeddings, and vectors", async () => {
    const directory = await createTempWorkspace();
    const storage = new SQLiteStorage(path.join(directory, "mind-weave.sqlite"), {
      vectorDimensions: 8
    });
    const embeddingProvider = new CountingEmbeddingProvider();
    const indexer = createIndexer(storage, embeddingProvider);
    const candidate = await writeMarkdownCandidate(directory, "note.md", `# One

First section.

# Two

Second section.
`, 1000);

    const result = await indexer.upsert(candidate);

    expect(result).toMatchObject({
      status: "indexed",
      chunkCount: 2,
      embeddedChunkCount: 2,
      preservedChunkCount: 0
    });
    expect(storage.countRows("chunks")).toBe(2);
    expect(storage.countRows("embeddings")).toBe(2);
    expect(storage.countRows("vec_embeddings")).toBe(2);
    expect(embeddingProvider.calls).toHaveLength(1);

    storage.close();
  });

  it("skips unchanged file metadata without embedding again", async () => {
    const directory = await createTempWorkspace();
    const storage = new SQLiteStorage(path.join(directory, "mind-weave.sqlite"), {
      vectorDimensions: 8
    });
    const embeddingProvider = new CountingEmbeddingProvider();
    const indexer = createIndexer(storage, embeddingProvider);
    const candidate = await writeMarkdownCandidate(directory, "note.md", `# One

First section.
`, 1000);

    await indexer.upsert(candidate);
    const result = await indexer.upsert(candidate);

    expect(result).toMatchObject({
      status: "skipped",
      reason: "unchanged"
    });
    expect(embeddingProvider.calls).toHaveLength(1);

    storage.close();
  });

  it("embeds only changed chunk occurrences for a partial document change", async () => {
    const directory = await createTempWorkspace();
    const storage = new SQLiteStorage(path.join(directory, "mind-weave.sqlite"), {
      vectorDimensions: 8
    });
    const embeddingProvider = new CountingEmbeddingProvider();
    const indexer = createIndexer(storage, embeddingProvider);
    const firstCandidate = await writeMarkdownCandidate(directory, "note.md", `# One

Stable section.

# Two

Original section.
`, 1000);
    await indexer.upsert(firstCandidate);

    const secondCandidate = await writeMarkdownCandidate(directory, "note.md", `# One

Stable section.

# Two

Changed section.
`, 2000);
    const result = await indexer.upsert(secondCandidate);

    expect(result).toMatchObject({
      status: "indexed",
      chunkCount: 2,
      embeddedChunkCount: 1,
      preservedChunkCount: 1
    });
    expect(embeddingProvider.calls).toHaveLength(2);
    expect(embeddingProvider.calls[1]).toHaveLength(1);
    expect(storage.countRows("chunks")).toBe(2);
    expect(storage.countRows("embeddings")).toBe(2);
    expect(storage.countRows("vec_embeddings")).toBe(2);

    storage.close();
  });

  it("marks a previously indexed document stale when update processing fails", async () => {
    const directory = await createTempWorkspace();
    const storage = new SQLiteStorage(path.join(directory, "mind-weave.sqlite"), {
      vectorDimensions: 8
    });
    const embeddingProvider = new CountingEmbeddingProvider();
    const candidate = await writeMarkdownCandidate(directory, "note.md", `# One

First section.
`, 1000);
    await createIndexer(storage, embeddingProvider).upsert(candidate);

    const changedCandidate = await writeMarkdownCandidate(directory, "note.md", `# One

Changed section.
`, 2000);
    const result = await createIndexer(storage, embeddingProvider, [
      new FailingProcessor()
    ]).upsert(changedCandidate);

    expect(result).toMatchObject({
      status: "stale"
    });
    await expect(storage.listActiveDocuments("source_a")).resolves.toMatchObject([
      {
        status: "stale",
        lastError: "processor failed"
      }
    ]);
    expect(storage.countRows("chunks")).toBe(1);

    storage.close();
  });

  it("marks a never-indexed document failed when first processing fails", async () => {
    const directory = await createTempWorkspace();
    const storage = new SQLiteStorage(path.join(directory, "mind-weave.sqlite"), {
      vectorDimensions: 8
    });
    const embeddingProvider = new CountingEmbeddingProvider();
    const candidate = await writeMarkdownCandidate(directory, "note.md", `# One

First section.
`, 1000);

    const result = await createIndexer(storage, embeddingProvider, [
      new FailingProcessor()
    ]).upsert(candidate);

    expect(result).toMatchObject({
      status: "failed"
    });
    await expect(storage.listActiveDocuments("source_a")).resolves.toMatchObject([
      {
        status: "failed",
        lastError: "processor failed"
      }
    ]);
    expect(storage.countRows("chunks")).toBe(0);

    storage.close();
  });
});
