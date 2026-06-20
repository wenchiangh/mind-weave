import type {
  DocumentProcessor,
  ProcessableDocument,
  ProcessedChunk
} from "./contracts.js";
import {
  createChunkContentHash,
  createChunkId,
  normalizeChunkText
} from "../shared/identity.js";

export type MarkdownProcessorSettings = {
  readonly maxChunkChars?: number | undefined;
  readonly overlapChars?: number | undefined;
};

type ResolvedMarkdownProcessorSettings = {
  readonly maxChunkChars: number;
  readonly overlapChars: number;
};

type MarkdownSection = {
  readonly headingPath: readonly MarkdownHeading[];
  readonly body: string;
};

type MarkdownHeading = {
  readonly level: number;
  readonly text: string;
};

const defaultSettings: ResolvedMarkdownProcessorSettings = {
  maxChunkChars: 3000,
  overlapChars: 300
};

export class MarkdownProcessor implements DocumentProcessor {
  private readonly settings: ResolvedMarkdownProcessorSettings;

  constructor(settings: MarkdownProcessorSettings = {}) {
    this.settings = {
      maxChunkChars: settings.maxChunkChars ?? defaultSettings.maxChunkChars,
      overlapChars: settings.overlapChars ?? defaultSettings.overlapChars
    };
  }

  supports(fileType: string): boolean {
    return fileType === "markdown";
  }

  async process(document: ProcessableDocument): Promise<readonly ProcessedChunk[]> {
    if (!this.supports(document.fileType)) {
      return [];
    }

    const chunkTexts = splitMarkdown(stripFrontmatter(document.content), this.settings);

    return chunkTexts.map((text, index) => {
      const contentHash = createChunkContentHash(text);
      return {
        chunkId: createChunkId({
          documentId: document.documentId,
          chunkIndex: index,
          chunkContentHash: contentHash
        }),
        documentId: document.documentId,
        sourceId: document.sourceId,
        index,
        text,
        contentHash
      };
    });
  }
}

function splitMarkdown(
  markdown: string,
  settings: ResolvedMarkdownProcessorSettings
): readonly string[] {
  const sections = splitIntoSections(markdown);
  return sections.flatMap((section) => splitSection(section, settings));
}

function stripFrontmatter(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, "\n");

  if (!normalized.startsWith("---\n")) {
    return markdown;
  }

  const lines = normalized.split("\n");
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === "---") {
      return lines.slice(index + 1).join("\n");
    }
  }

  return markdown;
}

function splitIntoSections(markdown: string): readonly MarkdownSection[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const sections: MarkdownSection[] = [];
  const headingStack: MarkdownHeading[] = [];
  let bodyLines: string[] = [];
  let currentHeadingPath: readonly MarkdownHeading[] = [];

  const flush = (): void => {
    const body = bodyLines.join("\n").trim();
    if (body.length > 0) {
      sections.push({
        headingPath: currentHeadingPath,
        body
      });
    }
    bodyLines = [];
  };

  for (const line of lines) {
    const heading = parseHeading(line);

    if (heading !== null) {
      flush();
      while (
        headingStack.length > 0
        && (headingStack[headingStack.length - 1]?.level ?? 0) >= heading.level
      ) {
        headingStack.pop();
      }
      headingStack.push(heading);
      currentHeadingPath = [...headingStack];
      continue;
    }

    bodyLines.push(line);
  }

  flush();
  return sections;
}

function parseHeading(line: string): MarkdownHeading | null {
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
  if (match === null) {
    return null;
  }

  return {
    level: match[1]?.length ?? 1,
    text: match[2] ?? ""
  };
}

function splitSection(
  section: MarkdownSection,
  settings: ResolvedMarkdownProcessorSettings
): readonly string[] {
  const headingContext = formatHeadingContext(section.headingPath);
  const bodyChunks = splitOversizedText(section.body, settings);

  return bodyChunks
    .map((body) => normalizeChunkText(
      headingContext.length > 0 ? `${headingContext}\n\n${body}` : body
    ))
    .filter((text) => text.length > 0);
}

function formatHeadingContext(headings: readonly MarkdownHeading[]): string {
  return headings.map((heading) =>
    `${"#".repeat(heading.level)} ${heading.text}`
  ).join("\n\n");
}

function splitOversizedText(
  text: string,
  settings: ResolvedMarkdownProcessorSettings
): readonly string[] {
  const normalized = normalizeChunkText(text);
  if (normalized.length <= settings.maxChunkChars) {
    return normalized.length > 0 ? [normalized] : [];
  }

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = (): void => {
    const chunk = normalizeChunkText(current);
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    current = "";
  };

  for (const paragraph of paragraphs) {
    const cleanParagraph = normalizeChunkText(paragraph);
    if (cleanParagraph.length === 0) {
      continue;
    }

    if (cleanParagraph.length > settings.maxChunkChars) {
      pushCurrent();
      chunks.push(...splitLongText(cleanParagraph, settings));
      continue;
    }

    const next = current.length > 0 ? `${current}\n\n${cleanParagraph}` : cleanParagraph;
    if (next.length <= settings.maxChunkChars) {
      current = next;
      continue;
    }

    pushCurrent();
    current = withOverlap(chunks[chunks.length - 1], cleanParagraph, settings.overlapChars);
  }

  pushCurrent();
  return chunks;
}

function splitLongText(
  text: string,
  settings: ResolvedMarkdownProcessorSettings
): readonly string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + settings.maxChunkChars, text.length);
    chunks.push(normalizeChunkText(text.slice(start, end)));
    if (end === text.length) {
      break;
    }
    start = Math.max(end - settings.overlapChars, start + 1);
  }

  return chunks;
}

function withOverlap(
  previousChunk: string | undefined,
  nextText: string,
  overlapChars: number
): string {
  if (previousChunk === undefined || overlapChars <= 0) {
    return nextText;
  }

  const overlap = previousChunk.slice(-overlapChars);
  return normalizeChunkText(`${overlap}\n\n${nextText}`);
}
