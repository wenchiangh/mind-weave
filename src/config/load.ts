import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parse,
  printParseErrorCode,
  type ParseError
} from "jsonc-parser";
import type { ParsedConfigFile } from "./contracts.js";
import { ConfigError } from "./errors.js";

export function parseConfigText(text: string): unknown {
  const errors: ParseError[] = [];
  const data = parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false
  });

  if (errors.length > 0) {
    const issues = errors.map((error) => ({
      code: "CONFIG_JSONC_PARSE_FAILED" as const,
      message: printParseErrorCode(error.error),
      path: `offset:${error.offset}`
    }));

    throw new ConfigError({
      code: "CONFIG_JSONC_PARSE_FAILED",
      message: "Config file contains invalid JSONC.",
      issues
    });
  }

  return data;
}

export async function loadConfigFile(filePath: string): Promise<ParsedConfigFile> {
  const resolvedFilePath = path.resolve(filePath);

  let text: string;
  try {
    text = await readFile(resolvedFilePath, "utf8");
  } catch (error) {
    throw new ConfigError({
      code: "CONFIG_FILE_READ_FAILED",
      message: `Unable to read config file: ${resolvedFilePath}`,
      path: resolvedFilePath,
      cause: error
    });
  }

  return {
    filePath: resolvedFilePath,
    baseDir: path.dirname(resolvedFilePath),
    data: parseConfigText(text)
  };
}
