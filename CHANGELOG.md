# Change Log

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.0.1] - 2025-Aug-22: Initial release

- Added syntax highlighting for Google Sheets formulas, including functions, operators, and comments.
- Supports a wide range of Google Sheets functions and operators.
- Support for `.gsheets` file extension.
- Added comments support for lines starting with `//`.
- Updated README.md with installation instructions and features.
- Updated package.json with correct name and displayName.

## [0.0.2] - 2025-Aug-22

- Added a [script](scripts/helper/function2pattern.py) to generate patterns for the functions.
- Added another [script](scripts/generatelang.py) to update the jsonc patterns to the final [grammar file](syntaxes/gsheets.tmLanguage.json).
