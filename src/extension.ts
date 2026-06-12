import * as vscode from 'vscode';
import { JsonlPreviewProvider, PREVIEW_SCHEME, PREVIEW_URI } from './previewProvider';

function isJsonlDocument(doc: vscode.TextDocument): boolean {
	return /\.(jsonl|ndjson)$/i.test(doc.uri.path) || doc.languageId === 'jsonl';
}

function isPreviewVisible(): boolean {
	return vscode.window.visibleTextEditors.some(
		(editor) => editor.document.uri.scheme === PREVIEW_SCHEME
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
		vscode.commands.registerCommand('jsonlViewer.previewLine', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor || !isJsonlDocument(editor.document)) {
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
