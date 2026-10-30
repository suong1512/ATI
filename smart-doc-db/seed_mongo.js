db = db.getSiblingDB('smart_doc_mongo_db');

db.Invoice_payloads.insertMany([
  {
    _id: ObjectId("671e0a1b2c3d4e5f6a7b8c9d"),
    job_id: 1,
    raw_llm_output: "{\"invoice_number\":\"INV-FPT-001\",\"invoice_date\":\"2026-10-20\",\"supplier_name\":\"FPT Software\",\"subtotal\":1000.00,\"tax\":100.00,\"total\":1100.00}",
    created_at: new Date(),
    normalized_data: {
      invoice_number: "INV-FPT-001",
      invoice_date: new Date("2026-10-20"),
      supplier_name: "FPT Software",
      subtotal: 1000.00,
      tax: 100.00,
      total: 1100.00,
      Invoice_Item: [
        {
          description: "Cloud Server Hosting (1 Year)",
          quantity: 1,
          unit_price: 1000.00,
          line_amount: 1000.00
        }
      ]
    },
    confidence_scores: {
      overall: 0.985,
      invoice_number: 0.99,
      total: 0.99,
      items: 0.975
    }
  },
  {
    _id: ObjectId("671e0a1b2c3d4e5f6a7b8c9e"),
    job_id: 2,
    raw_llm_output: "{\"invoice_number\":\"REC-992\",\"invoice_date\":\"2026-10-22\",\"supplier_name\":\"Highlands Coffee\",\"subtotal\":50.00,\"tax\":5.00,\"total\":65.00}",
    created_at: new Date(),
    normalized_data: {
      invoice_number: "REC-992",
      invoice_date: new Date("2026-10-22"),
      supplier_name: "Highlands Coffee",
      subtotal: 50.00,
      tax: 5.00,
      total: 65.00, // Lỗi cố tình (50 + 5 != 65) để phục vụ demo tính năng Math Guardrail & Human Review
      Invoice_Item: [
        {
          description: "Phin Sua Da",
          quantity: 2,
          unit_price: 25.00,
          line_amount: 50.00
        }
      ]
    },
    confidence_scores: {
      overall: 0.65,
      invoice_number: 0.85,
      total: 0.40,
      items: 0.70
    }
  }
]);