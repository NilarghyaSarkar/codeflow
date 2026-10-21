# CodeFlow

A diagramming skill for Codex. Open a project, ask a question, and get an interactive HTML diagram you can explore, rearrange, export, and share.

```text
Use $codeflow to explain this project's architecture.
```

## Features

- Ten diagram types: architecture, workflow, sequence, data flow, lifecycle/state, entity relationship, class/interface, tree, timeline, and waterfall.
- Standalone interactive HTML with light and dark themes and a custom indigo-and-teal style.
- Draggable architecture boxes: connections, labels, and surrounding boundaries adjust automatically.
- Undo, reset, saved layout JSON, and draft SVG downloads.
- Search, focus, tracing, presentation, and the bundled viewer's export controls.
- Detailed code-backed diagrams with request paths, failure branches, source links, and a companion debugging guide. Also accepts descriptions and Mermaid.

## Requirements

- Codex installed and signed in.
- Node.js 18 or newer. No npm installation is required for the runtime.
- Google Chrome or Chromium for the full browser verification gate. For a custom browser location, set `ARCHIFY_CHROME` to its executable path.

## Install from the ZIP

1. [Download codeflow-skill.zip](downloads/codeflow-skill.zip?raw=true).
2. Extract it and open the extracted `codeflow-skill` folder in a terminal.
3. Run:

   ```sh
   node install.mjs
   ```

4. In any existing or new project, start a new turn in Codex and ask:

   ```text
   Use $codeflow to explain this project's architecture.
   ```

If CodeFlow does not appear, restart Codex. The installer copies the complete skill to `~/.agents/skills/codeflow`, so the extracted download can be deleted afterward. This is Codex's [user skill location](https://learn.chatgpt.com/docs/build-skills).

The matching [SHA-256 checksum](downloads/codeflow-skill.zip.sha256) is included for verification.

## Install from source

```sh
git clone https://github.com/NilarghyaSarkar/codeflow.git
cd codeflow
node install.mjs
```

An identical installation is safe to repeat. A different existing installation is left untouched. Back it up outside the skill directory before replacing it. See [INSTALL.md](INSTALL.md) for custom locations, Windows paths, and manual installation.

## Use it in Codex

Open the project you want to understand and ask, for example:

```text
Use $codeflow to show how a request moves through this project.
Use $codeflow to explain checkout in detail so I can debug failed payments.
Use $codeflow for a quick architecture overview, diagram only.
Use $codeflow to diagram checkout as a sequence, including cache misses.
Use $codeflow to turn this Mermaid diagram into interactive HTML.
Use $codeflow to explain the database schema as an entity-relationship diagram.
```

The skill creates a new request folder under `.archify/` in the current project, containing the candidate JSON, HTML diagram, and verification receipts. Open the HTML to explore the result.

Repository explanations default to enough implementation detail to follow a real operation: entry points, handler/service calls, data reads and writes, and material conditions or failures supported by the inspected source. Native source links and supporting cards help you navigate the code. A companion `debugging.md` adds the execution walkthrough, investigation points, relevant configuration, and facts that still need runtime evidence. A complex mechanism can receive a focused Sequence or Workflow diagram.

Ask for a quick overview or diagram-only output to keep it concise. Existing diagrams need re-authoring to receive richer analysis; moving boxes only changes their layout.

### Rearrange architecture boxes

1. Open a newly generated Architecture diagram and click **Move boxes**.
2. Drag a component. Its existing connections and labels reroute, and enclosing boundaries resize.
3. Use **Undo** or **Reset layout** to restore positions.
4. Choose **Save layout JSON** to keep the draft for later regeneration, or **Download draft SVG** for an image of the current arrangement.

Give saved layout JSON back to CodeFlow to validate and regenerate interactive HTML. The editor keeps a draft in the current page session; the checked reader and its standard exports retain the original layout. Older HTML needs regeneration to receive the editor. Dragging applies to Architecture diagrams.

## Run the CLI directly

From any project's working directory:

```sh
node ~/.agents/skills/codeflow/bin/codeflow.mjs finalize workflow candidate.json diagram.html --quality showcase --json
```

For package readiness checks:

```sh
node codeflow/bin/codeflow.mjs doctor
```

Input/output paths resolve from your current working directory. The runtime retains `ARCHIFY_*` configuration names for compatibility. Upstream update reminders remain informational and do not install updates automatically.

## Repository contents

- `codeflow/` — complete skill, rendering runtime, viewer assets, schemas, examples, and references.
- `install.mjs` — portable installer for macOS, Linux, and Windows.
- `downloads/` — ready-to-share ZIP and checksum.
- `source-provenance.json` — upstream revision, original hashes, and recorded customizations.

## License and attribution

CodeFlow includes and extends the open-source [Archify](https://github.com/tt-a1i/archify) runtime, with its upstream MIT license and notices preserved. The custom style and architecture layout editor are included in this distribution. See [LICENSE](LICENSE), [third-party notices](codeflow/THIRD_PARTY_NOTICES.md), and [font license](codeflow/assets/JetBrainsMono-OFL.txt).
