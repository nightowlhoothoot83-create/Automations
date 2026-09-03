# Automation 3 — safe asset inventory

This workstream inventories only an explicitly supplied directory. It reads files, records provenance, classifies likely asset use, and uses SHA-256 plus byte size for exact duplicate groups. Similar-looking files are never called exact duplicates. Symbolic links are skipped.

The output is a proposed-action manifest. It never moves, renames, overwrites, consolidates, or deletes originals. `possibleDuplicates` remains separate and empty until a reviewed similarity adapter is added.

Run: `node src/asset-inventory-cli.mjs --root <explicit-folder> --output artifacts/automation-3/inventory-v1.json`.
