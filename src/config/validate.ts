import { z } from "zod";
import type { UserConfig } from "./contracts.js";
import {
  ConfigError,
  type ConfigErrorCode,
  type ConfigErrorIssue
} from "./errors.js";

const nonEmptyString = z.string().min(1);

const localFsSourceSchema = z.object({
  type: z.literal("local-fs"),
  id: nonEmptyString.optional(),
  name: nonEmptyString.optional(),
  rootPath: nonEmptyString,
  exclude: z.array(nonEmptyString).optional()
}).strict();

const embeddingSchema = z.object({
  provider: z.literal("openai-compatible"),
  model: nonEmptyString,
  baseUrl: nonEmptyString,
  apiKeyEnv: nonEmptyString,
  dimensions: z.number().int().positive().optional(),
  batchSize: z.number().int().positive().optional()
}).strict();

const storageSchema = z.object({
  type: z.literal("sqlite"),
  path: nonEmptyString
}).strict();

const mcpSchema = z.object({
  enabled: z.boolean().optional()
}).strict();

const userConfigSchema = z.object({
  sources: z.array(localFsSourceSchema).min(1),
  embedding: embeddingSchema,
  storage: storageSchema,
  mcp: mcpSchema.optional()
}).strict();

export function validateUserConfig(data: unknown): UserConfig {
  const result = userConfigSchema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues.map(toConfigErrorIssue);
  throw new ConfigError({
    code: issues[0]?.code ?? "CONFIG_SCHEMA_INVALID",
    message: "Config schema is invalid.",
    issues
  });
}

function toConfigErrorIssue(issue: z.core.$ZodIssue): ConfigErrorIssue {
  const path = formatIssuePath(issue.path);

  return {
    code: classifyIssue(issue),
    message: issue.message,
    path
  };
}

function classifyIssue(issue: z.core.$ZodIssue): ConfigErrorCode {
  const path = formatIssuePath(issue.path);

  if (path.endsWith(".type") && path.startsWith("sources.")) {
    return "CONFIG_UNSUPPORTED_SOURCE_TYPE";
  }

  if (path === "storage.type") {
    return "CONFIG_UNSUPPORTED_STORAGE_TYPE";
  }

  if (path === "embedding.provider") {
    return "CONFIG_UNSUPPORTED_EMBEDDING_TYPE";
  }

  return "CONFIG_SCHEMA_INVALID";
}

function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.map((part) => String(part)).join(".");
}
