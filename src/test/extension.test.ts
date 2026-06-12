import * as assert from 'assert';
import { formatJsonlLine } from '../previewProvider';

suite('formatJsonlLine', () => {
	test('formats a valid JSON row with header comment', () => {
		const result = formatJsonlLine('data/sample.jsonl', 0, '{"a":1,"b":[true,null]}');
		assert.strictEqual(
			result,
			'// data/sample.jsonl:1\n' + JSON.stringify({ a: 1, b: [true, null] }, null, 2)
		);
	});

	test('uses 1-based line numbers in the header', () => {
		const result = formatJsonlLine('x.jsonl', 41, '{}');
		assert.ok(result.startsWith('// x.jsonl:42\n'));
	});

	test('reports invalid JSON and includes the raw line', () => {
		const raw = '{"oops": missing_quotes}';
		const result = formatJsonlLine('x.jsonl', 2, raw);
		assert.ok(result.includes('// Invalid JSON:'));
		assert.ok(result.endsWith(raw));
	});

	test('handles empty lines', () => {
		const result = formatJsonlLine('x.jsonl', 3, '   ');
		assert.strictEqual(result, '// x.jsonl:4\n// (empty line)');
	});
});
