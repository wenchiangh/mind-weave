import type { RuntimeHealth } from "./contracts.js";

export function getRuntimeHealth(): RuntimeHealth {
  return {
    name: "mind-weave-core",
    status: "ok"
  };
}
