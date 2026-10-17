---
name: design-orchestrator
description: >
  Governs the 3-tier free frontend redesign pipeline for NexusGraph: Google Stitch MCP
  for page layouts, 21st.dev MCP for animated micro-components, and Antigravity for contract wiring.
  Enforces frontend-contract.ts adherence, design tokens, and Git worktree isolation.
---

# Design Orchestrator Skill

## Purpose

This skill governs the **3-Layer Free Design Pipeline** for NexusGraph:
1. **Google Stitch MCP** (`@_davideast/stitch-mcp`): Macro layout generation, color palettes, and full-screen templates via natural language.
2. **21st.dev MCP** (`@21st-dev/magic` / `@21st-dev/cli`): Production-grade React/Tailwind micro-components, Framer Motion animations, charts, and interactive controls.
3. **Antigravity Orchestration**: Assembling layouts and components, strictly binding them to FastAPI backend endpoints via `frontend-contract.ts`.

---

## Activation Triggers

Activate this skill when:
- The user requests UI redesign, visual updates, new dashboards, or component styling.
- Stitch layouts or 21st.dev components are being searched, generated, or imported.
- The `nexusgraph-redesign` worktree (`feat/superdesign-ui` branch) is active.
- Designing or modifying any React/Next.js component in `frontend/src/`.

---

## Mandatory Constraints

### 1. Worktree Isolation (CRITICAL)
- **NEVER modify frontend production files on the `main` branch** during design iterations.
- All experimental and generated UI code MUST be authored and tested inside the isolated Git worktree:
  - Worktree Path: `c:\Users\Bhatn\OneDrive\Desktop\Projects\github\nexusgraph-redesign`
  - Target Branch: `feat/superdesign-ui`
- Only after user review and visual verification in the browser may features be merged to `main`.

### 2. Strict Contract Binding (`frontend-contract.ts`)
- Every UI element that displays data MUST consume types and endpoint helpers from:
  `frontend/src/lib/frontend-contract.ts`
- **Zero Hallucinated Endpoints**: All API requests must use `ENDPOINTS` from the contract.
- **Strict Payload Types**: SSE events MUST match `AgentStepEvent`, graph topology MUST match `SubgraphPayload`, and node colors MUST follow `NODE_COLORS`.

### 3. Design Token Adherence
All components must use established tokens from `frontend-contract.ts` and `globals.css`:
- **Background**: `#07090e` (base), `#0b0f19` (panels), `#0f172a` (elevated)
- **Accents**:
  - Cyan (`#06b6d4`): Services, Recon agent, primary actions
  - Amber (`#f59e0b`): Commits, Historian agent, warnings
  - Emerald (`#10b981`): ADRs, Executor agent, healthy states
  - Rose (`#f43f5e`): Incidents, errors, chaos triggers
- **Panels**: Use `.glass-panel` and `.glass-panel-elevated` classes.

---

## Layer-by-Layer Workflow

### Layer 1: Google Stitch (Macro Layouts)
- Use Stitch when generating brand-new screen structures, layouts, or side-by-side grid topologies.
- Command / Tool: `stitch-mcp proxy` or web interface at [stitch.withgoogle.com](https://stitch.withgoogle.com/).
- Output: Clean HTML/CSS structure and layout wireframe.

### Layer 2: 21st.dev (Micro-Components)
- Use 21st.dev to fetch high-polish, interactive micro-components:
  - Streaming log viewers, agent thought ribbons
  - Animated tabs, badges, metrics cards
  - Real-time charts and graph legends
- Command / Tool: `21st` MCP tools or CLI (`21st add <slug>`, `21st search <query>`).

### Layer 3: Antigravity Assembly
- Import the fetched components into `nexusgraph-redesign/frontend/src/components/`.
- Replace mock data with typed hooks and `ENDPOINTS` from `frontend-contract.ts`.
- Verify with Next.js dev server and browser preview before requesting user review.
