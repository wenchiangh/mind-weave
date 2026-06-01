export type RuntimeHealth = {
  readonly name: "mind-weave-core";
  readonly status: "ok";
};

export interface AppRuntime {
  getHealth(): RuntimeHealth;
  start(): Promise<void>;
  stop(): Promise<void>;
}
