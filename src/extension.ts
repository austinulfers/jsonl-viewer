import * as vscode from 'vscode';
import { JsonlPreviewProvider, PREVIEW_SCHEME, PREVIEW_URI } from './previewProvider';

function isJsonlUri(uri: vscode.Uri): boolean {
	return /\.(jsonl|ndjson)$/i.test(uri.path);
}

function isJsonlDocument(doc: vscode.TextDocument): boolean {
	return isJsonlUri(doc.uri) || doc.languageId === 'jsonl';
}

function isPreviewVisible(): boolean {
	return vscode.window.visibleTextEditors.some(
		(editor) => editor.document.uri.scheme === PREVIEW_SCHEME
	);
}

/**
 * Resolves the JSONL editor to preview. Prefers the active editor, then a
 * resource URI passed by the editor title/context menu, then any visible
 * JSONL editor. Returns undefined if no JSONL document can be found.
 */
async function resolveJsonlEditor(
	resource?: vscode.Uri
): Promise<vscode.TextEditor | undefined> {
	const active = vscode.window.activeTextEditor;
	if (active && isJsonlDocument(active.document)) {
		return active;
	}

	if (resource instanceof vscode.Uri && isJsonlUri(resource)) {
		const doc = await vscode.workspace.openTextDocument(resource);
		return vscode.window.showTextDocument(doc, { preview: false });
	}

	return vscode.window.visibleTextEditors.find((editor) =>
		isJsonlDocument(editor.document)
	);
}

export function activate(context: vscode.ExtensionContext) {
	const provider = new JsonlPreviewProvider();

	const showPreview = async (editor: vscode.TextEditor) => {
		provider.update(editor.document, editor.selection.active.line);
		const doc = await vscode.workspace.openTextDocument(PREVIEW_URI);
		await vscode.languages.setTextDocumentLanguage(doc, 'jsonc');
		await vscode.window.showTextDocument(doc, {
			viewColumn: vscode.ViewColumn.Beside,
			preserveFocus: true,
			preview: true,
		});
	};

	// Follow the cursor while a preview is visible (debounced).
	let debounce: ReturnType<typeof setTimeout> | undefined;
	const selectionListener = vscode.window.onDidChangeTextEditorSelection((event) => {
		if (!isJsonlDocument(event.textEditor.document)) {
			return;
		}
		if (!vscode.workspace.getConfiguration('jsonlViewer').get<boolean>('followCursor', true)) {
			return;
		}
		if (!isPreviewVisible()) {
			return;
		}
		clearTimeout(debounce);
		debounce = setTimeout(() => {
			provider.update(event.textEditor.document, event.textEditor.selection.active.line);
		}, 100);
	});

	context.subscriptions.push(
		provider,
		vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, provider),
		vscode.commands.registerCommand('jsonlViewer.previewLine', async (resource?: vscode.Uri) => {
			const editor = await resolveJsonlEditor(resource);
			if (!editor) {
				vscode.window.showInformationMessage('Open a .jsonl or .ndjson file to preview a row.');
				return;
			}
			await showPreview(editor);
		}),
		selectionListener,
		new vscode.Disposable(() => clearTimeout(debounce))
	);
}

export function deactivate() {}
