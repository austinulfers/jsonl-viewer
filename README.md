# JSONL Viewer

Preview a formatted, syntax-highlighted view of any row in a `.jsonl` / `.ndjson` file — without copying it into a separate file.

## Install Locally

Package the extension as a `.vsix` and install it into VS Code:

```bash
npm install
npm install -g @vscode/vsce
vsce package
code --install-extension jsonl-viewer-0.0.1.vsix
```

Then reload VS Code. To update later, bump the version, re-run `vsce package`, and install the new `.vsix`.

## Usage

1. Open a `.jsonl` or `.ndjson` file.
2. Place the cursor on the row you want to inspect.
3. Run **JSONL: Preview Row** via:
   - the keybinding `Cmd+Alt+J` (macOS) / `Ctrl+Alt+J` (Windows/Linux),
   - the `{}` icon in the editor title bar,
   - the editor right-click context menu, or
   - the Command Palette.

A read-only, pretty-printed view of the row opens beside the editor, with full JSON highlighting and folding. While the preview is open, it follows your cursor: moving to another row updates the preview automatically.

Rows that fail to parse show the parse error and the raw line so you can spot the problem.

## Extension Settings

* `jsonlViewer.followCursor` (default `true`): automatically update the preview as the cursor moves between rows while the preview is open.

## Development

- `npm run compile` — type-check, lint, and bundle.
- `npm test` — run tests.
- Press `F5` to launch an Extension Development Host; open `sample.jsonl` to try it out.
