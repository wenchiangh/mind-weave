import { describe, expect, it } from "vitest";
import type { ProcessableDocument } from "./contracts.js";
import { MarkdownProcessor } from "./markdown.js";
import {
  createChunkContentHash,
  createChunkId
} from "../shared/identity.js";

function createDocument(content: string, fileType = "markdown"): ProcessableDocument {
  return {
    documentId: "doc_notes",
    sourceId: "source_notes",
    uri: "file:///notes/example.md",
    fileType,
    content,
    sourceUpdatedAt: 1000
  };
}

describe("MarkdownProcessor", () => {
  it("supports markdown files only", () => {
    const processor = new MarkdownProcessor();

    expect(processor.supports("markdown")).toBe(true);
    expect(processor.supports("text")).toBe(false);
  });

  it("returns no chunks for unsupported file types", async () => {
    const chunks = await new MarkdownProcessor().process(
      createDocument("# Title\n\nBody", "text")
    );

    expect(chunks).toEqual([]);
  });

  it("includes heading context directly in chunk text", async () => {
    const chunks = await new MarkdownProcessor().process(createDocument(`# Project

Intro.

## Decision

Use local processing.`));

    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "# Project\n\nIntro.",
      "# Project\n\n## Decision\n\nUse local processing."
    ]);
  });

  it("emits content before the first heading", async () => {
    const chunks = await new MarkdownProcessor().process(createDocument(`Opening note.

# Later

More detail.`));

    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "Opening note.",
      "# Later\n\nMore detail."
    ]);
  });

  it("strips complete YAML frontmatter", async () => {
    const chunks = await new MarkdownProcessor().process(createDocument(`---
title: Note
---

# Body

Visible text.`));

    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "# Body\n\nVisible text."
    ]);
  });

  it("keeps incomplete frontmatter as normal content", async () => {
    const chunks = await new MarkdownProcessor().process(createDocument(`---
title: Note

# Body

Visible text.`));

    expect(chunks[0]?.text).toContain("title: Note");
  });

  it("splits oversized sections and applies overlap inside the same section", async () => {
    const chunks = await new MarkdownProcessor({
      maxChunkChars: 30,
      overlapChars: 5
    }).process(createDocument(`# Big

First paragraph is here.

Second paragraph is here.

Third paragraph is here.`));

    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "# Big\n\nFirst paragraph is here.",
      "# Big\n\nhere.\n\nSecond paragraph is here.",
      "# Big\n\nhere.\n\nThird paragraph is here."
    ]);
  });

  it("splits oversized paragraphs by character windows", async () => {
    const chunks = await new MarkdownProcessor({
      maxChunkChars: 10,
      overlapChars: 3
    }).process(createDocument("abcdefghijklmnopqrstuv"));

    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "abcdefghij",
      "hijklmnopq",
      "opqrstuv"
    ]);
  });

  it("does not overlap across different heading sections", async () => {
    const chunks = await new MarkdownProcessor({
      maxChunkChars: 20,
      overlapChars: 5
    }).process(createDocument(`# One

First paragraph.

# Two

Second paragraph.`));

    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "# One\n\nFirst paragraph.",
      "# Two\n\nSecond paragraph."
    ]);
  });

  it("computes content hashes and chunk IDs from final chunk text", async () => {
    const chunks = await new MarkdownProcessor().process(createDocument(`# Title

Text.`));
    const chunk = chunks[0];

    expect(chunk).toBeDefined();
    if (chunk !== undefined) {
      const expectedHash = createChunkContentHash(chunk.text);
      expect(chunk.contentHash).toBe(expectedHash);
      expect(chunk.chunkId).toBe(createChunkId({
        documentId: "doc_notes",
        chunkIndex: 0,
        chunkContentHash: expectedHash
      }));
    }
  });

  it("produces deterministic output across repeated runs", async () => {
    const processor = new MarkdownProcessor();
    const document = createDocument(`# Stable

Text.`);

    await expect(processor.process(document)).resolves.toEqual(
      await processor.process(document)
    );
  });
});
