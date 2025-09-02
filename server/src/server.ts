import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  TextDocumentPositionParams,
  InitializeResult,
} from "vscode-languageserver/node";
import { CompletionItemKind } from "vscode-languageserver/node";
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
      // TODO:
      // hoverProvider : true,
      // signatureHelpProvider : {
      // 	triggerCharacters: [ '(' ]
      // }
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
    // Register for all configuration changes.
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
  // Load formulas now that we have a connection to log to
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

connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    return suggestions;
  }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

// Listen on the connection
connection.listen();
