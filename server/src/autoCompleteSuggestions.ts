import { CompletionItemKind } from "vscode-languageserver/node";

export const suggestions = [
	{
		label: "ARRAYFORMULA",
		kind: CompletionItemKind.Function,
		data: 1
	},
	{
		label: "SUM",
		kind: CompletionItemKind.Function,
		data: 2
	}
]