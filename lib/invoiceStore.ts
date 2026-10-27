import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtractionResult } from "./invoiceSchema";

/**
 * Minimal mock "database".
 *
 * The target architecture (see `project_details.md`) stores extracted invoices in
 * SQLite via Prisma. Until that layer is added, results are appended to a JSON
 * file on disk so the `upload -> json -> database` pipeline is already real and
 * demonstrable.
 *
 * Limitations (documented, on purpose):
 *  - single process / local filesystem only (not suitable for serverless deploy)
 *  - no concurrency control, no querying, no RBAC
 */

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "invoices.json");
const MAX_RECORDS = 50;

export type StoredInvoice = ExtractionResult;

export async function listInvoices(): Promise<StoredInvoice[]> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredInvoice[]) : [];
  } catch {
    return [];
  }
}

export async function saveInvoice(record: StoredInvoice): Promise<StoredInvoice> {
  const existing = await listInvoices();
  const next = [record, ...existing].slice(0, MAX_RECORDS);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return record;
}

export async function clearInvoices(): Promise<number> {
  const existing = await listInvoices();
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, "[]\n", "utf8");
  return existing.length;
}
