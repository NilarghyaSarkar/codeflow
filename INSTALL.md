# Install CodeFlow in Codex

CodeFlow creates interactive architecture and other diagrams from project code,
plain-language descriptions, or Mermaid. Architecture diagrams include draggable
boxes, automatic connection routing, undo/reset, and layout JSON and SVG exports.

## Requirements

- Codex installed and signed in.
- Node.js 18 or newer (`node --version`). No `npm install` is needed.
- Google Chrome or Chromium for the skill's browser verification gate. If it is
  installed in a custom location, set `ARCHIFY_CHROME` to its executable path.

## Install from the ZIP

1. Extract **codeflow-skill.zip**. Open the extracted **codeflow-skill** folder.
2. Open a terminal in that folder and run:

   ```sh
   node install.mjs
   ```

   This copies the complete `codeflow` folder into
   `~/.agents/skills/codeflow` (on Windows, your user profile's
   `.agents\skills\codeflow` folder). It applies to existing and new projects.
   You can delete the extracted download after a successful installation.

3. On your next turn in Codex, open any project and ask:

   ```text
   Use $codeflow to explain this project's architecture.
   ```

   If the skill has not appeared, restart Codex and try again.

You can run the installer from any folder by supplying its full path:

```sh
node "/path/to/codeflow-skill/install.mjs"
```

## Install using Codex

After extracting the ZIP, give Codex the extracted folder's path and ask:

```text
Install the CodeFlow skill from /path/to/codeflow-skill for all my projects.
Read INSTALL.md and run the included installer.
```

## Existing installations and custom locations

An identical installation is safe to repeat. If a different `codeflow` folder
already exists at the destination, the installer leaves it unchanged and exits
with an error. Back up that folder outside `.agents/skills` before replacing it.

For a different supported skill location, pass the full skill directory:

```sh
node install.mjs --dest "/path/to/skills/codeflow"
```

For manual installation, copy the entire extracted `codeflow` folder into
`~/.agents/skills/`. Keep its `SKILL.md`, assets, renderers, schemas, references,
examples, and command files together. Copying just `SKILL.md` is insufficient.

Codex's user skill location and invocation syntax are documented in the
[official OpenAI skill guide](https://learn.chatgpt.com/docs/build-skills).

## What is included

- `codeflow/`: the complete standalone skill and runtime.
- `install.mjs`: the portable installer for macOS, Linux, and Windows.
- `INSTALL.md`: these instructions.
- `source-provenance.json`: upstream revision, original hashes, and local changes.

The package includes the Archify runtime and its MIT license, font license, and
third-party notices. Those files remain in the `codeflow` folder. No project
source code, credentials, or account configuration is included.
