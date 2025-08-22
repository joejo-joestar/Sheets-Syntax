import json
from pathlib import Path

# Paths
base_grammar_path = (
    Path(__file__).parent.parent / "syntaxes" / "gsheets.tmLanguage.json"
)
syntaxlists_dir = Path(__file__).parent / "syntaxlists"
output_path = base_grammar_path

# Load base grammar
with open(base_grammar_path, encoding="utf-8") as f:
    grammar = json.load(f)


# For each syntax list, update the corresponding repository section
for key in ["functions", "operators", "constants"]:
    syntax_file = syntaxlists_dir / f"{key}.json"
    if syntax_file.exists():
        with open(syntax_file, encoding="utf-8") as f:
            syntax_json = json.load(f)
        # Expecting { "repository": { key: { "patterns": [...] } } }
        patterns = syntax_json.get("repository", {}).get(key, {}).get("patterns", [])
        if key in grammar.get("repository", {}):
            grammar["repository"][key]["patterns"] = patterns
        else:
            grammar["repository"][key] = {"patterns": patterns}

# Dynamically generate the top-level patterns array from repository keys
grammar["patterns"] = [
    {"include": f"#{key}"} for key in grammar.get("repository", {}).keys()
]

# Write updated grammar
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(grammar, f, indent=4)

print(f"Updated {output_path} with patterns from syntaxlists and dynamic includes.")
