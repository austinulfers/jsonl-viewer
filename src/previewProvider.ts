import * as vscode from 'vscode';

export const PREVIEW_SCHEME = 'jsonl-preview';

/** Single fixed URI so the same preview tab is reused for every row. */
export const PREVIEW_URI = vscode.Uri.parse(`${PREVIEW_SCHEME}:/JSONL Row Preview.jsonc`);

/**
 * Formats one line of a JSONL file for display.
 * Exported separately from the provider so it can be unit-tested.
 */
export function formatJsonlLine(sourceLabel: string, lineNumber: number, lineText: string): string {
	const header = `// ${sourceLabel}:${lineNumber + 1}`;
	const trimmed = lineText.trim();
	if (trimmed.length === 0) {
		return `${header}\n// (empty line)`;
	}
	try {
		const parsed = JSON.parse(trimmed);
		return `${header}\n${JSON.stringify(parsed, null, 2)}`;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return `${header}\n// Invalid JSON: ${message}\n\n${lineText}`;
	}
}

export class JsonlPreviewProvider implements vscode.TextDocumentContentProvider {
	private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChange = this._onDidChange.event;

	private content = '// Place the cursor on a row in a .jsonl file and run "JSONL: Preview Row".';

	/** Re-render the preview for the given source document and line. */
	update(sourceDoc: vscode.TextDocument, lineNumber: number): void {
		const label = vscode.workspace.asRelativePath(sourceDoc.uri, false);
		const lineText = sourceDoc.lineAt(lineNumber).text;
		this.content = formatJsonlLine(label, lineNumber, lineText);
		this._onDidChange.fire(PREVIEW_URI);
	}

	provideTextDocumentContent(): string {
		return this.content;
	}

	dispose(): void {
		this._onDidChange.dispose();
	}
}
