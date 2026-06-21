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
- [P1 macOS Tauri Shell](./phases/p1-macos-tauri-shell/00_direction.md): future product shell direction, intentionally kept thin until Core MVP is validated.

Phase directories contain scope, implementation planning, and open questions for a specific stage. They are expected to evolve or be superseded as the project moves forward.
