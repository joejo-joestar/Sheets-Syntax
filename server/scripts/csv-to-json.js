const fs = require('fs');
const path = require('path');

const inPath = path.join(__dirname, '..', 'src', 'formulas.csv');
const outPath = path.join(__dirname, '..', 'src', 'formulas.json');

function parseCSV(contents) {
	const lines = [];
	let cur = '';
	let row = [];
	let inQuotes = false;
	for (let i = 0; i < contents.length; i++) {
		const ch = contents[i];
		if (ch === '"') {
			if (inQuotes && contents[i + 1] === '"') {
				cur += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}
		if (ch === ',' && !inQuotes) {
			row.push(cur);
			cur = '';
			continue;
		}
		if ((ch === '\n' || ch === '\r') && !inQuotes) {
			// handle CRLF or LF
			if (cur !== '' || row.length > 0) {
				row.push(cur);
				lines.push(row);
				row = [];
				cur = '';
			}
			// skip possible second char in CRLF
			if (ch === '\r' && contents[i + 1] === '\n') i++;
			continue;
		}
		// normal char
		cur += ch;
	}
	// push any remaining
	if (cur !== '' || row.length > 0) {
		row.push(cur);
		lines.push(row);
	}
	return lines;
}

try {
	const raw = fs.readFileSync(inPath, 'utf8');
	const rows = parseCSV(raw);
	if (rows.length === 0) {
		console.error('No rows found in CSV');
		process.exit(1);
	}
	const header = rows[0].map(h => h.trim());
	const dataRows = rows.slice(1).filter(r => r.length > 1);
	const out = dataRows.map((r) => {
		const obj = {};
		for (let i = 0; i < header.length; i++) {
			const key = header[i] || `col${i}`;
			obj[key] = (r[i] || '').trim();
		}
		return obj;
	}).filter(o => o.label);

	const withId = out.map((o, _) => ({
		label: o.label,
		detail: o.detail || '',
		documentation: o.documentation || '',
	}));

	fs.writeFileSync(outPath, JSON.stringify(withId, null, 2), 'utf8');
	console.log(`Wrote ${withId.length} entries to ${outPath}`);
} catch (err) {
	console.error(err && err.message ? err.message : String(err));
	process.exit(1);
}
