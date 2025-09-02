import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  TextDocumentPositionParams,
  InitializeResult, CompletionItemKind, TextDocuments,
  SignatureHelp,
  SignatureInformation,
  ParameterInformation
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as fs from 'fs';
import * as path from 'path';

// Load formulas.json at runtime from multiple possible locations.
function tryLoadFormulas(): { formulas: any[]; path?: string } {
  const candidates = [
    path.join(__dirname, 'formulas.json'), // compiled out/formulas.json
    path.join(__dirname, '..', 'src', 'formulas.json'), // src during dev
    path.join(process.cwd(), 'server', 'src', 'formulas.json'), // workspace root
    path.join(process.cwd(), 'server', 'out', 'formulas.json'), // alternative out
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        return { formulas: parsed, path: p };
      }
    } catch (err) {
      // continue to next candidate
      console.warn(`Failed to read/parse formulas.json at ${p}: ${err}`);
    }
  }
  return { formulas: [], path: undefined };
}

let suggestions: CompletionItem[] = [];
let formulasPathUsed: string | undefined;

const connection = createConnection(ProposedFeatures.all);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      completionProvider: {
        resolveProvider: true,
      },
      signatureHelpProvider: {
        triggerCharacters: ['(']
      },
      hoverProvider: true
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.");
    });
  }
  try {
    const result = tryLoadFormulas();
    formulasPathUsed = result.path;
    suggestions = (result.formulas || []).map((f: any) => ({
      label: f.label,
      kind: CompletionItemKind.Function,
      detail: f.detail,
      documentation: f.documentation,
      data: (f.label || '').toLowerCase(),
    }));
    if (formulasPathUsed) {
      connection.console.log(`Loaded formulas.json from ${formulasPathUsed} (${suggestions.length} entries)`);
    } else {
      connection.console.log('No formulas.json found; completion suggestions empty');
    }
  } catch (e) {
    connection.console.log(`Error loading formulas.json: ${e}`);
  }
});

connection.onDidChangeWatchedFiles((_change) => {
  connection.console.log("We received a file change event");
  // reload formulas when files change
  try {
    const result = tryLoadFormulas();
    formulasPathUsed = result.path;
    suggestions = (result.formulas || []).map((f: any) => ({
      label: f.label,
      kind: CompletionItemKind.Function,
      detail: f.detail,
      documentation: f.documentation,
      data: (f.label || '').toLowerCase(),
    }));
    connection.console.log(`Reloaded formulas.json from ${formulasPathUsed || '<none>'} (${suggestions.length} entries)`);
  } catch (err) {
    connection.console.log(`Failed to reload formulas.json: ${err}`);
  }
});

// Listen for document events
documents.listen(connection);

// MARK: Code Completion
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    return suggestions;
  }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

// MARK: Function Signatures Help
connection.onSignatureHelp(
  (params: TextDocumentPositionParams): SignatureHelp | null => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const pos = params.position;
    const text = doc.getText();
    const offset = doc.offsetAt(pos);

    // Find the last '(' before the cursor
    const before = text.slice(0, offset);
    const parenIndex = before.lastIndexOf('(');
    if (parenIndex === -1) return null;

    // Extract the identifier immediately before '('
    const nameMatch = before.slice(0, parenIndex).match(/([A-Za-z_][A-ZaLz0-9_]*)\s*$/);
    if (!nameMatch) return null;
    const name = nameMatch[1];
    const nameUpper = name.toUpperCase();

    // Find formula suggestion by exact match or prefix
    let formula = suggestions.find(f => (f.label || '').toUpperCase() === nameUpper);
    if (!formula) {
      formula = suggestions.find(f => (f.label || '').toUpperCase().startsWith(nameUpper));
    }
    if (!formula) return null;

    const label = (formula.detail || formula.label || '').toString();
    const docStr = (formula.documentation || '').toString();

    // Parse parameter labels from the detail (text inside parentheses)
    const paramsList: string[] = [];
    const m = label.match(/\(([^)]*)\)/);
    if (m && m[1].trim().length > 0) {
      paramsList.push(...m[1].split(',').map(s => s.trim()));
    }

    const signature: SignatureInformation = {
      label,
      documentation: docStr,
      parameters: paramsList.map(p => ({ label: p } as ParameterInformation)),
    };

    // Determine active parameter by counting commas between '(' and cursor
    const between = text.slice(parenIndex + 1, offset);
    const commaCount = (between.match(/,/g) || []).length;
    const activeParameter = Math.min(commaCount, Math.max(0, paramsList.length - 1));

    const signatureHelp: SignatureHelp = {
      signatures: [signature],
      activeSignature: 0,
      activeParameter,
    };
    return signatureHelp;
  }
);

// MARK: Show Hover
connection.onHover(
  (params): { contents: string | { language: string; value: string } } | null => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }
    const position = params.position;
    const text = doc.getText();
    const lines = text.split(/\r?\n/g);
    if (position.line >= lines.length) {
      return null;
    }
    const line = lines[position.line];
    const wordMatch = line.slice(0, position.character).match(/([A-Za-z_][A-Za-z0-9_]*)$/);
    if (!wordMatch) {
      return null;
    }
    const word = wordMatch[1];
    const wordNorm = word.toUpperCase();
    let formula = suggestions.find(f => (f.label || '').toUpperCase() === wordNorm);
    if (!formula) {
      formula = suggestions.find(f => (f.label || '').toUpperCase().startsWith(wordNorm));
    }
    if (formula) {
      return {
        contents: { language: 'gsheets', value: `${formula.detail}\n\n${formula.documentation}` }
      };
    }
    return null;
  }
);

// Listen on the connection
connection.listen();
