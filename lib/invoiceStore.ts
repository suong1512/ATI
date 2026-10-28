import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connectMongoDatabase, getMysqlPool } from "./database";
import { extractionResultSchema, type ExtractionResult } from "./invoiceSchema";

const MONGO_COLLECTION = "Extraction_Records";
const MAX_RECORDS = 50;

let schemaInitialization: Promise<void> | undefined;

type InvoiceIndexRow = RowDataPacket & {
  record_id: string;
};

export class InvoiceStoreError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvoiceStoreError";
  }
}

async function getStorage() {
  const pool = getMysqlPool();
  const mongoDatabase = await connectMongoDatabase();

  if (!schemaInitialization) {
    schemaInitialization = pool
      .query(`
        CREATE TABLE IF NOT EXISTS Extracted_Invoice (
          record_id VARCHAR(64) NOT NULL PRIMARY KEY,
          created_at DATETIME(3) NOT NULL,
          file_name VARCHAR(1024) NOT NULL,
          mime_type VARCHAR(127) NOT NULL,
          file_size BIGINT UNSIGNED NOT NULL,
          document_kind ENUM('pdf', 'png', 'jpeg') NOT NULL,
          content_hash CHAR(16) NOT NULL,
          invoice_number VARCHAR(255) NOT NULL,
          seller_name VARCHAR(500) NOT NULL,
          total_amount DECIMAL(20, 2) NOT NULL,
          INDEX idx_extracted_invoice_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaInitialization = undefined;
        throw error;
      });
  }

  await schemaInitialization;
  return {
    pool,
    collection: mongoDatabase.collection<ExtractionResult & { _id: string }>(MONGO_COLLECTION),
  };
}

export async function listInvoices(): Promise<ExtractionResult[]> {
  try {
    const { pool, collection } = await getStorage();
    const [rows] = await pool.execute<InvoiceIndexRow[]>(
      `SELECT record_id
       FROM Extracted_Invoice
       ORDER BY created_at DESC, record_id DESC
       LIMIT ?`,
      [MAX_RECORDS],
    );
    const recordIds = rows.map((row) => row.record_id);
    if (recordIds.length === 0) {
      return [];
    }

    const documents = await collection.find({ _id: { $in: recordIds } }).toArray();
    const documentsById = new Map(
      documents.map((document) => [String(document._id), document]),
    );

    return recordIds.map((recordId) => {
      const document = documentsById.get(recordId);
      if (!document) {
        throw new Error(`MongoDB payload is missing for invoice ${recordId}.`);
      }

      const { _id: _mongoId, ...payload } = document;
      if (_mongoId !== recordId) {
        throw new Error(`MongoDB returned an unexpected invoice payload for ${recordId}.`);
      }
      return extractionResultSchema.parse(payload);
    });
  } catch (error) {
    throw new InvoiceStoreError("Unable to read invoices from the database.", { cause: error });
  }
}

export async function saveInvoice(record: ExtractionResult): Promise<ExtractionResult> {
  try {
    const { pool, collection } = await getStorage();
    await collection.replaceOne(
      { _id: record.recordId },
      record,
      { upsert: true },
    );

    try {
      await pool.execute(
        `INSERT INTO Extracted_Invoice
          (record_id, created_at, file_name, mime_type, file_size, document_kind,
           content_hash, invoice_number, seller_name, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.recordId,
          new Date(record.createdAt),
          record.source.fileName,
          record.source.mimeType,
          record.source.sizeBytes,
          record.source.kind,
          record.source.contentHash,
          record.invoice.invoiceNumber,
          record.invoice.sellerName,
          record.invoice.totalAmount,
        ],
      );
    } catch (error) {
      try {
        await collection.deleteOne({ _id: record.recordId });
      } catch (cleanupError) {
        console.error("[invoiceStore] Failed to remove MongoDB payload after SQL insert failed.", cleanupError);
      }
      throw error;
    }

    return record;
  } catch (error) {
    throw new InvoiceStoreError("Unable to save invoice to the database.", { cause: error });
  }
}

export async function clearInvoices(): Promise<number> {
  try {
    const { pool, collection } = await getStorage();
    const [result] = await pool.execute<ResultSetHeader>("DELETE FROM Extracted_Invoice");
    await collection.deleteMany({});
    return result.affectedRows;
  } catch (error) {
    throw new InvoiceStoreError("Unable to clear invoices from the database.", { cause: error });
  }
}
