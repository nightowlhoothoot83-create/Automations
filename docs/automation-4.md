# Automation 4 — asset-to-product preparation

Automation 4 consumes the versioned read-only Automation 3 inventory and emits a practical `READY`, `NEEDS WORK`, or `BLOCKED` product queue. It preserves master provenance and keeps photography, POD, digital downloads, publishing assets, and brand packs distinct.

POD output targets the multi-provider workflow and never chooses a provider. Marketplace fields remain empty until current specifications are supplied. The pipeline never publishes, spends, orders, mutates accounts, or overwrites masters.

Run: `node src/product-readiness-cli.mjs --inventory <inventory-v1.json> --output artifacts/automation-4/product-queue-v1.json`.
