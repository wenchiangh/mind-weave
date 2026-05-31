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
