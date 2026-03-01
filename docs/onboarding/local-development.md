# Local Development Guide

## Workspaces Structure Reminder
Because we use `pnpm` workspaces, any package in `packages/*` is automatically symlinked into your `node_modules`. 

If you make a change to `packages/core`, you **do not** need to rebuild it to see the change in `apps/worker-etl`. Tools like `ts-node` or `swc` in Next.js will resolve the core source directly during `pnpm dev`.

## Environment Variables
Create a local `.env.local` inside the app you are running.
* **API Server (`apps/api`)** needs MongoDB URIs, JWT secrets, and the Master Encryption Key (`AES_MASTER_KEY`).
* **Worker (`apps/worker-*`)** needs the exact same MongoDB URIs, Master Encryption Key (for decrypting API credentials out of Mongo), and BullMQ/Redis networking.
* **Core Packages (`packages/*`)** do not need `.env` files. If you find yourself importing `dotenv` into the pipeline logic, you have violated architecture rules.

## Debugging Jobs
Monitor your Redis instance. If the Worker pod crashes silently, the BullMQ GUI will show the Job transitioned from `Active` to `Stalled`. 
Read the Dead Letter Queue documents in MongoDB to see actual Canonical payload validation failures.
