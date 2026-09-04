// Robust CSV layer for LEDsRepair CRM v2.
// Loaded after app-v2.js so it can replace the original lightweight parser
// without changing the rest of the import/mapping workflow.

let robustCsvRawText = '';
let robustCsvFileName = '';
let robustCsvForcedDelimiter = '';

function csvDelimiterLabel(delimiter) {
  return delimiter === ',' ? 'komma (,)' : delimiter === ';' ? 'puntkomma (;)' : delimiter === '\t' ? 'tab' : delimiter === '|' ? 'pipe (|)' : delimiter || 'onbekend';
}

function countPhysicalLines(text) {
  return text ? text.split(/\r\n|\n|\r/).filter(line => line.trim() !== '').length : 0;
}

function parseDelimitedRows(text, delimiter, options = {}) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let unclosedQuote = false;
  const resetQuotesAtNewline = !!options.resetQuotesAtNewline;
  const maxRows = options.maxRows || Infinity;

  const pushRow = () => {
    row.push(field);
    field = '';
    if (row.some(value => String(value).trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '\\' && next === '"') {
        // Be tolerant of non-RFC exporters that escape quotes as \".
        field += '"';
        i++;
      } else if (ch === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else if (next === delimiter || next === '\n' || next === '\r' || next === undefined) {
          // Only close a quoted field where a closing quote is actually plausible.
          // This prevents inch signs / stray quotes from swallowing the rest of the file.
          inQuotes = false;
        } else {
          field += '"';
        }
      } else if ((ch === '\n' || ch === '\r') && resetQuotesAtNewline) {
        inQuotes = false;
        if (ch === '\r' && next === '\n') i++;
        pushRow();
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field.trim() === '') {
      field = '';
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++;
      pushRow();
    } else {
      // A quote in the middle of an unquoted value is a literal quote (e.g. 24").
      field += ch;
    }
  }

  if (inQuotes) unclosedQuote = true;
  if (field.length || row.length) pushRow();
  return { rows, unclosedQuote };
}

function stripExcelSeparatorDirective(text) {
  const match = text.match(/^\s*sep=(.)\s*(?:\r\n|\n|\r)/i);
  if (!match) return { text, declaredDelimiter: '' };
  return { text: text.slice(match[0].length), declaredDelimiter: match[1] === '\\t' ? '\t' : match[1] };
}

function delimiterScore(text, delimiter) {
  const parsed = parseDelimitedRows(text, delimiter, { maxRows: 30 });
  const rows = parsed.rows.slice(0, 25);
  if (!rows.length) return -Infinity;

  const counts = rows.map(row => row.length);
  const frequencies = new Map();
  counts.forEach(count => frequencies.set(count, (frequencies.get(count) || 0) + 1));
  const [modeColumns, modeFrequency] = [...frequencies.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  const consistency = modeFrequency / counts.length;
  const headerColumns = counts[0] || 1;

  // Prefer multiple, consistent columns. This avoids choosing comma merely because
  // European decimal values contain commas inside a semicolon-delimited file.
  return (modeColumns > 1 ? 1000 : 0) + consistency * 160 + modeColumns * 14 - Math.abs(headerColumns - modeColumns) * 8 - (parsed.unclosedQuote ? 40 : 0);
}

function robustDetectDelimiter(text) {
  const directive = stripExcelSeparatorDirective(text);
  if (directive.declaredDelimiter) return directive.declaredDelimiter;
  const candidates = [',', ';', '\t', '|'];
  return candidates
    .map(delimiter => ({ delimiter, score: delimiterScore(directive.text, delimiter) }))
    .sort((a, b) => b.score - a.score)[0].delimiter;
}

function makeUniqueHeaders(rawHeaders) {
  const seen = new Map();
  return rawHeaders.map((raw, index) => {
    const base = String(raw || '').trim() || `Kolom ${index + 1}`;
    const key = normalize(base);
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function robustParseCSV(inputText, forcedDelimiter = '') {
  let text = String(inputText || '').replace(/^\uFEFF/, '');
  const directive = stripExcelSeparatorDirective(text);
  text = directive.text;
  const delimiter = forcedDelimiter || directive.declaredDelimiter || robustDetectDelimiter(text);
  const physicalLines = countPhysicalLines(text);

  let parsed = parseDelimitedRows(text, delimiter);
  let usedRecovery = false;

  // A malformed quote in one row should never turn an entire supplier list into one product.
  // If the quote-aware parser reaches EOF while still quoted and collapsed many physical rows,
  // retry in tolerant line-recovery mode.
  if (parsed.unclosedQuote && physicalLines >= 3 && parsed.rows.length < Math.max(2, Math.floor(physicalLines / 3))) {
    parsed = parseDelimitedRows(text, delimiter, { resetQuotesAtNewline: true });
    usedRecovery = true;
  }

  if (!parsed.rows.length) return { headers: [], rows: [], delimiter, diagnostics: { physicalLines, usedRecovery, malformedRows: 0 } };

  const headers = makeUniqueHeaders(parsed.rows[0]);
  const dataRows = parsed.rows.slice(1);
  const malformedRows = dataRows.filter(row => row.length !== headers.length).length;
  const rows = dataRows.map(values => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '').trim()])));

  return {
    headers,
    rows,
    delimiter,
    diagnostics: {
      physicalLines,
      malformedRows,
      usedRecovery,
      unclosedQuote: parsed.unclosedQuote,
      sourceRows: dataRows.length
    }
  };
}

async function readCsvText(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    try { return new TextDecoder('utf-16be').decode(bytes.subarray(2)); } catch { /* fall through */ }
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));

  // Basic UTF-16 heuristic for Excel exports without a BOM.
  const sample = bytes.subarray(0, Math.min(bytes.length, 4000));
  let evenNulls = 0, oddNulls = 0;
  sample.forEach((value, index) => { if (value === 0) index % 2 ? oddNulls++ : evenNulls++; });
  if (oddNulls > sample.length * 0.15) return new TextDecoder('utf-16le').decode(bytes);
  if (evenNulls > sample.length * 0.15) {
    try { return new TextDecoder('utf-16be').decode(bytes); } catch { /* fall through */ }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function ensureCsvRobustUi() {
  if (!document.getElementById('csvRobustStyles')) {
    const style = document.createElement('style');
    style.id = 'csvRobustStyles';
    style.textContent = `
      .csv-diagnostics{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.018)}
      .csv-diagnostics-top{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .csv-diagnostics .field{min-width:180px}
      .csv-health{font-size:11px;color:var(--muted);line-height:1.5}
      .csv-health strong{color:var(--text)}
      .csv-warning{color:var(--warn)}
      .csv-preview{margin-top:10px;overflow:auto;border:1px solid var(--line);border-radius:9px}
      .csv-preview table{min-width:max-content;width:100%}
      .csv-preview th,.csv-preview td{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:7px 9px;font-size:10px}
      @media(max-width:560px){.csv-diagnostics-top{align-items:stretch;flex-direction:column}.csv-diagnostics .field{min-width:0;width:100%}.csv-preview th,.csv-preview td{max-width:150px}}
    `;
    document.head.appendChild(style);
  }

  let box = document.getElementById('csvDiagnostics');
  if (box) return box;
  box = document.createElement('div');
  box.id = 'csvDiagnostics';
  box.className = 'csv-diagnostics hidden';
  box.innerHTML = `
    <div class="csv-diagnostics-top">
      <div id="csvHealth" class="csv-health"></div>
      <label class="field">
        <span>Scheidingsteken</span>
        <select id="csvDelimiterOverride">
          <option value="">Automatisch</option>
          <option value=",">Komma (,)</option>
          <option value=";">Puntkomma (;)</option>
          <option value="TAB">Tab</option>
          <option value="|">Pipe (|)</option>
        </select>
      </label>
    </div>
    <div id="csvPreview" class="csv-preview"></div>
  `;
  const fileInfo = document.getElementById('fileInfo');
  fileInfo?.insertAdjacentElement('afterend', box);
  document.getElementById('csvDelimiterOverride')?.addEventListener('change', event => {
    robustCsvForcedDelimiter = event.target.value === 'TAB' ? '\t' : event.target.value;
    reparseRobustCsv();
  });
  return box;
}

function renderCsvDiagnostics() {
  const box = ensureCsvRobustUi();
  if (!csvContext) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const d = csvContext.diagnostics || {};
  const warnings = [];
  if (d.usedRecovery) warnings.push('een foutieve/onafgesloten quote is automatisch hersteld');
  if (d.malformedRows) warnings.push(`${d.malformedRows} rij(en) hebben een afwijkend aantal kolommen`);
  const health = document.getElementById('csvHealth');
  health.innerHTML = `<strong>${csvContext.rows.length} producten/rijen gevonden</strong><br>${csvContext.headers.length} kolommen · ${csvDelimiterLabel(csvContext.delimiter)}${warnings.length ? `<br><span class="csv-warning">Let op: ${warnings.join(' · ')}</span>` : ''}`;

  const previewHeaders = csvContext.headers.slice(0, 8);
  const previewRows = csvContext.rows.slice(0, 4);
  document.getElementById('csvPreview').innerHTML = `
    <table>
      <thead><tr>${previewHeaders.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${previewRows.map(row => `<tr>${previewHeaders.map(h => `<td title="${esc(row[h])}">${esc(row[h]) || '—'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

function applyRobustParse(parsed, fileName) {
  if (!parsed.headers.length) throw new Error('Geen kolommen gevonden');
  csvContext = { ...parsed, fileName, rawText: robustCsvRawText };
  const fileInfo = document.getElementById('fileInfo');
  fileInfo.classList.remove('hidden');
  fileInfo.textContent = `${fileName} · ${parsed.rows.length} rijen · ${parsed.headers.length} kolommen`;
  renderMappings();
  renderCsvDiagnostics();

  // Hard safety net: never silently import one logical row when the file visibly contains many rows.
  const collapsed = parsed.rows.length <= 1 && (parsed.diagnostics?.physicalLines || 0) >= 4;
  document.getElementById('runImportBtn').disabled = !parsed.rows.length || collapsed;
  if (collapsed) toast('Import geblokkeerd: het bestand bevat meerdere regels maar werd niet correct opgesplitst. Kies het scheidingsteken handmatig.', true);
}

function reparseRobustCsv() {
  if (!robustCsvRawText) return;
  try {
    applyRobustParse(robustParseCSV(robustCsvRawText, robustCsvForcedDelimiter), robustCsvFileName);
  } catch (error) {
    csvContext = null;
    document.getElementById('runImportBtn').disabled = true;
    toast(error.message || 'CSV kon niet gelezen worden.', true);
  }
}

async function robustHandleCSV(file) {
  if (!file) return;
  try {
    robustCsvRawText = await readCsvText(file);
    robustCsvFileName = file.name;
    robustCsvForcedDelimiter = '';
    const delimiterSelect = ensureCsvRobustUi().querySelector('#csvDelimiterOverride');
    if (delimiterSelect) delimiterSelect.value = '';
    applyRobustParse(robustParseCSV(robustCsvRawText), file.name);
  } catch (error) {
    csvContext = null;
    document.getElementById('fileInfo').classList.add('hidden');
    document.getElementById('mappingRows').innerHTML = '<div class="empty-state compact">CSV kon niet gelezen worden.</div>';
    document.getElementById('runImportBtn').disabled = true;
    ensureCsvRobustUi().classList.add('hidden');
    toast(error.message || 'CSV kon niet gelezen worden.', true);
  }
}

// Replace the light parser used by app-v2.js. Existing input/drop listeners resolve
// handleCSV at event time, so they automatically use this implementation.
detectDelimiter = robustDetectDelimiter;
parseCSV = robustParseCSV;
handleCSV = robustHandleCSV;

ensureCsvRobustUi();
