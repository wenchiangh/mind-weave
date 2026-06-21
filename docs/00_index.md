# MindWeave Documentation

This directory separates stable project knowledge from phase-specific execution material.

## Stable Documents

- [Product Brief](./01_product_brief.md): product positioning, target users, core value, and product shape.
- [Architecture](./02_architecture.md): system architecture, module boundaries, runtime model, and core design principles.

## Phase Documents

- [P0 Core MVP](./phases/2026-05-31-p0-core-mvp/00_spec.md): first execution phase for the TypeScript core runtime.
  - [Implementation Outline](./phases/2026-05-31-p0-core-mvp/01_implementation_plan.md)
  - [Open Questions](./phases/2026-05-31-p0-core-mvp/02_open_questions.md)
  - [Detailed Design](./phases/2026-05-31-p0-core-mvp/03_detailed_design.md)
  - [Execution Index](./phases/2026-05-31-p0-core-mvp/04_execution_index.md)
- [P0.5 Runtime Capabilities and Agent Access](./phases/2026-06-21-p0-runtime-capabilities-agent-access/00_spec.md): next runtime phase for real MCP stdio access, logs, status, and command workflow semantics.
  - [Implementation Outline](./phases/2026-06-21-p0-runtime-capabilities-agent-access/01_implementation_plan.md)
  - [Open Questions](./phases/2026-06-21-p0-runtime-capabilities-agent-access/02_open_questions.md)
  - [Detailed Design](./phases/2026-06-21-p0-runtime-capabilities-agent-access/03_detailed_design.md)
  - [Execution Index](./phases/2026-06-21-p0-runtime-capabilities-agent-access/04_execution_index.md)
- [P0.6 Dogfooding Hardening](./phases/2026-06-21-p0-6-dogfooding-hardening/00_spec.md): small hardening phase based on the first real-vault dogfooding trial.
  - [Dogfooding Findings](./phases/2026-06-21-p0-6-dogfooding-hardening/00_dogfooding_findings.md)
  - [Implementation Outline](./phases/2026-06-21-p0-6-dogfooding-hardening/01_implementation_outline.md)
  - [Execution Index](./phases/2026-06-21-p0-6-dogfooding-hardening/02_execution_index.md)
  - [Local Usage Guide](./phases/2026-06-21-p0-6-dogfooding-hardening/03_local_usage_guide.md)
- [P0.7 Agent Usage Workflow](./phases/2026-06-21-p0-7-agent-usage-workflow/00_spec.md): evaluation phase for agent retrieval workflow and MCP contract hardening decisions.
  - [Agent Workflow](./phases/2026-06-21-p0-7-agent-usage-workflow/01_agent_workflow.md)
  - [Retrieval Eval Set](./phases/2026-06-21-p0-7-agent-usage-workflow/02_eval_set.md)
  - [Eval Results](./phases/2026-06-21-p0-7-agent-usage-workflow/03_eval_results.md)
  - [Contract Review](./phases/2026-06-21-p0-7-agent-usage-workflow/04_contract_review.md)
  - [Execution Index](./phases/2026-06-21-p0-7-agent-usage-workflow/05_execution_index.md)
- [P0.8 Retrieval Result Metadata](./phases/2026-06-21-p0-8-retrieval-result-metadata/00_spec.md): focused runtime contract hardening for source-relative path, current chunk position, and Markdown heading metadata.
  - [Implementation Plan](./phases/2026-06-21-p0-8-retrieval-result-metadata/01_implementation_plan.md)
  - [Execution Index](./phases/2026-06-21-p0-8-retrieval-result-metadata/02_execution_index.md)
- [P0.9 Runtime SDK and Shell Bridge Boundary](./phases/2026-06-21-p0-9-runtime-sdk-and-shell-bridge-boundary/00_spec.md): boundary-definition phase for the Core runtime SDK, future Tauri sidecar bridge, and human-control versus agent-access surfaces.
  - [Boundary Design](./phases/2026-06-21-p0-9-runtime-sdk-and-shell-bridge-boundary/01_boundary_design.md)
  - [Open Questions](./phases/2026-06-21-p0-9-runtime-sdk-and-shell-bridge-boundary/02_open_questions.md)
  - [Execution Index](./phases/2026-06-21-p0-9-runtime-sdk-and-shell-bridge-boundary/03_execution_index.md)
  - [Runtime SDK Surface Audit](./phases/2026-06-21-p0-9-runtime-sdk-and-shell-bridge-boundary/04_runtime_sdk_surface_audit.md)
  - [Runtime SDK Boundary Plan](./phases/2026-06-21-p0-9-runtime-sdk-and-shell-bridge-boundary/05_runtime_sdk_boundary_plan.md)
  - [Shell Bridge Transport Decision](./phases/2026-06-21-p0-9-runtime-sdk-and-shell-bridge-boundary/06_bridge_transport_decision.md)
- [P1 macOS Menu Bar Shell](./phases/p1-macos-menu-bar-shell/00_spec.md): menu bar / tray-first local runtime shell for observing and controlling MindWeave.
  - [MVP Scope](./phases/p1-macos-menu-bar-shell/01_mvp_scope.md)
  - [Execution Index](./phases/p1-macos-menu-bar-shell/02_execution_index.md)
- [P1 macOS Tauri Shell Direction](./phases/p1-macos-tauri-shell/00_direction.md): earlier direction note, superseded by the menu bar shell phase documents for MVP planning.

Phase directories contain scope, implementation planning, and open questions for a specific stage. They are expected to evolve or be superseded as the project moves forward.
