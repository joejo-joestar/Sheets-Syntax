import json
from pathlib import Path

input_path = Path(__file__).parent / "function_list.txt"
output_path = Path(__file__).parent.parent / "syntaxlists" / "functions.json"


with open(input_path, encoding="utf-8") as f:
    lines = [line.strip() for line in f if line.strip()]

if not lines:
    raise ValueError("Input file is empty.")

patterns_list = [
    {
        "name": "entity.name.function.gsheets",
        "match": f"({fn.replace('.', '\\.')}(?=\\())",
    }
    for fn in lines
]

output_json = {"repository": {"functions": {"patterns": patterns_list}}}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output_json, f, indent=4)

print(
    f"Converted {len(lines)} patterns to JSON objects in repository format: {output_path}"
)
