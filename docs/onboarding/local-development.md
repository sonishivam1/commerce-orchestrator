# Local Development Guide

## Workspaces Structure Reminder
Because we use `pnpm` workspaces, any package in `packages/*` is automatically symlinked into your `node_modules`. 

If you make a change to `packages/core`, you **do not** need to rebuild it to see the change in `apps/worker`. Tools like `ts-node` or `swc` in Next.js will resolve the core source directly during `pnpm dev`.

## Environment Variables
Create a local `.env.local` inside the app you are running.
* **API Server (`apps/api`)** needs MongoDB URIs, JWT secrets, and the Master Encryption Key (`AES_MASTER_KEY`).
* **Worker (`apps/worker`)** needs the exact same MongoDB URIs, Master Encryption Key (for decrypting connection credentials out of Mongo), and BullMQ/Redis networking. Plus `EXPORT_DIR` for file-export output.
* **Core Packages (`packages/*`)** do not need `.env` files. If you find yourself importing `dotenv` into the pipeline logic, you have violated architecture rules.

## Debugging runs
Monitor your Redis instance. If the worker crashes silently, the BullMQ GUI shows the job going from `Active` to `Stalled`.
Inspect `migration_runs` in MongoDB — `waves[]` for per-entity progress and `failedItems[]` for canonical validation failures.
