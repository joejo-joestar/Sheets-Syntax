import json
from pathlib import Path
import re

# --- Configuration ---
SYNTAX_COMPONENTS_DIR = Path(__file__).parent / "repository"
OUTPUT_GRAMMAR_PATH = Path(__file__).parent / "gsheets.tmLanguage.json"

# --- Main Grammar Definition ---
GRAMMAR_DEFINITION = {
    "$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
    "name": "gsheets",
    "scopeName": "source.gsheets",
    "patterns": [
        {"include": "#functions"},
        {"include": "#strings"},
        {"include": "#errors"},
        {"include": "#constants"},
        {"include": "#operators"},
    ],
    "repository": {}
}

def build_grammar():
    """Assembles and writes the grammar file from component parts."""
    print("🚀 Starting grammar build process...")

    try:
        functions_path = SYNTAX_COMPONENTS_DIR / "functions.txt"
        with functions_path.open("r", encoding="utf-8") as f:
            function_names = [line.strip() for line in f if line.strip()]

        function_patterns = [
            {"name": "entity.name.function.gsheets", "match": f"({re.escape(name)}(?=\\())"}
            for name in sorted(function_names)
        ]
        # Wrap the generated function rules in the required structure
        GRAMMAR_DEFINITION["repository"]["functions"] = {"patterns": function_patterns}
        print(f"  -> Processed {len(function_names)} functions.")
    except FileNotFoundError:
        print("  -> functions.txt not found, skipping.")

    component_names = ["constants", "errors", "operators", "strings"]
    for name in component_names:
        file_path = SYNTAX_COMPONENTS_DIR / f"{name}.json"
        if file_path.exists():
            with file_path.open("r", encoding="utf-8") as f:
                # Load the array of rules from the file
                rules_array = json.load(f)

            # Wrap the array in the {"patterns": ...} object required by the repository
            GRAMMAR_DEFINITION["repository"][name] = {"patterns": rules_array}
            print(f"  -> Loaded component: {name}.json")
        else:
            print(f"  -> {name}.json not found, skipping.")

    OUTPUT_GRAMMAR_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_GRAMMAR_PATH.open("w", encoding="utf-8") as f:
        json.dump(GRAMMAR_DEFINITION, f, indent=4)

    print(f"\n✅ Grammar built successfully at: {OUTPUT_GRAMMAR_PATH}")

if __name__ == "__main__":
    build_grammar()