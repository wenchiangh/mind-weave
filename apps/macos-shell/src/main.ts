import "./styles.css";
import {
  readBridgeHealth,
  readRuntimeStatus,
  startWatch,
  stopWatch,
  triggerScan
} from "./bridge-client.js";
import { createShellPanelModel } from "./status-model.js";
import { renderShell } from "./view.js";
import {
  copyText,
  openLocalPath
} from "./platform-actions.js";

const defaultBridgeUrl = "http://127.0.0.1:7348";

const root = document.querySelector<HTMLElement>("#app");

if (root !== null) {
  const [health, runtimeStatus] = await Promise.all([
    readBridgeHealth({
      baseUrl: defaultBridgeUrl
    }),
    readRuntimeStatus({
      baseUrl: defaultBridgeUrl
    })
  ]);
  const model = createShellPanelModel({
    health,
    runtimeStatus
  });

  renderShell(root, model, {
    onScan: () => triggerScan({
      baseUrl: defaultBridgeUrl
    }),
    onWatchStart: () => startWatch({
      baseUrl: defaultBridgeUrl
    }),
    onWatchStop: () => stopWatch({
      baseUrl: defaultBridgeUrl
    }),
    onCopyMcpSetup: model.mcp.detail.includes(" / ")
      ? () => copyText(model.mcp.detail.split(" / ")[1] ?? "")
      : undefined,
    onOpenConfig: model.config.primaryPath === undefined
      ? undefined
      : () => openLocalPath(model.config.primaryPath ?? ""),
    onOpenLogs: model.logs.primaryPath === undefined
      ? undefined
      : () => openLocalPath(model.logs.primaryPath ?? ""),
    onOpenSource: model.sources.primaryPath === undefined
      ? undefined
      : () => openLocalPath(model.sources.primaryPath ?? "")
  });
}
