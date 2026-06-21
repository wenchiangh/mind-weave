import type { ShellBridgeCommandResult } from "./bridge-client.js";
import {
  createWatchControlState,
  type ShellPanelModel,
  type StatusRow
} from "./status-model.js";

export type ShellPanelActions = {
  readonly onScan?: (() => Promise<ShellBridgeCommandResult>) | undefined;
  readonly onWatchStart?: (() => Promise<ShellBridgeCommandResult>) | undefined;
  readonly onWatchStop?: (() => Promise<ShellBridgeCommandResult>) | undefined;
  readonly onCopyMcpSetup?: (() => Promise<void>) | undefined;
  readonly onOpenConfig?: (() => void) | undefined;
  readonly onOpenLogs?: (() => void) | undefined;
  readonly onOpenSource?: (() => void) | undefined;
};

export function renderShell(
  root: HTMLElement,
  model: ShellPanelModel,
  actions: ShellPanelActions = {}
): void {
  root.innerHTML = "";
  root.append(createPanel(model, actions));
}

function createPanel(model: ShellPanelModel, actions: ShellPanelActions): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "panel";

  const title = document.createElement("h1");
  title.textContent = model.title;

  panel.append(
    title,
    createStatusRow(model.runtime),
    createStatusRow(model.provider),
    createStatusRow(model.index),
    createDetailRow(model.storage.label, model.storage.detail),
    createStatusRow(model.watch),
    createControls(model, actions),
    createStatusRow(model.mcp),
    createPathControls(actions),
    createDetailRow(model.config.label, model.config.detail),
    createDetailRow(model.logs.label, model.logs.detail),
    createDetailRow(model.sources.label, model.sources.detail)
  );
  return panel;
}

function createPathControls(actions: ShellPanelActions): HTMLElement {
  const controls = document.createElement("section");
  controls.className = "controls";
  const feedback = document.createElement("p");
  feedback.className = "action-feedback";
  feedback.textContent = "";

  controls.append(
    createVoidButton("Copy MCP", actions.onCopyMcpSetup, feedback),
    createVoidButton("Open Config", actions.onOpenConfig, feedback),
    createVoidButton("Open Logs", actions.onOpenLogs, feedback),
    createVoidButton("Open Source", actions.onOpenSource, feedback),
    feedback
  );

  return controls;
}

function createControls(model: ShellPanelModel, actions: ShellPanelActions): HTMLElement {
  const controls = document.createElement("section");
  controls.className = "controls";

  const feedback = document.createElement("p");
  feedback.className = "action-feedback";
  feedback.textContent = "";
  const watchControls = createWatchControlState(model.watch.status);

  controls.append(
    createButton("Scan", actions.onScan, feedback),
    createButton("Start Watch", actions.onWatchStart, feedback, !watchControls.canStart),
    createButton("Stop Watch", actions.onWatchStop, feedback, !watchControls.canStop),
    feedback
  );

  return controls;
}

function createButton(
  label: string,
  action: (() => Promise<ShellBridgeCommandResult>) | undefined,
  feedback: HTMLElement,
  forceDisabled = false
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = forceDisabled || action === undefined;
  button.addEventListener("click", () => {
    if (action === undefined) {
      return;
    }

    void action().then((result) => {
      feedback.textContent = result.status === "available"
        ? `${label} completed`
        : result.message;
    });
  });
  return button;
}

function createVoidButton(
  label: string,
  action: (() => void | Promise<void>) | undefined,
  feedback: HTMLElement
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = action === undefined;
  button.addEventListener("click", () => {
    if (action === undefined) {
      return;
    }

    void Promise.resolve(action()).then(() => {
      feedback.textContent = `${label} completed`;
    });
  });
  return button;
}

function createStatusRow(row: StatusRow): HTMLElement {
  const element = createDetailRow(row.label, row.detail);
  element.classList.add(`status-${row.status}`);
  return element;
}

function createDetailRow(label: string, detail: string): HTMLElement {
  const row = document.createElement("section");
  row.className = "row";

  const rowLabel = document.createElement("p");
  rowLabel.className = "label";
  rowLabel.textContent = label;

  const rowDetail = document.createElement("p");
  rowDetail.className = "detail";
  rowDetail.textContent = detail;

  row.append(rowLabel, rowDetail);
  return row;
}
