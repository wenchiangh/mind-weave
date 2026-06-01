export type EntityId = string;
export type UriString = string;
export type RelativePath = string;
export type FileType = string;

// Unix epoch milliseconds. Keep timestamps numeric until a UI layer needs formatting.
export type UnixMilliseconds = number;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type MetadataRecord = Readonly<Record<string, JsonValue>>;
export type Vector = readonly number[];
