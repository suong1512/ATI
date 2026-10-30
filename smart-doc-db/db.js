const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function requiredEnvironmentVariable(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: requiredEnvironmentVariable('MYSQL_USER'),
  password: requiredEnvironmentVariable('MYSQL_PASSWORD'),
  database: requiredEnvironmentVariable('MYSQL_DATABASE'),
  waitForConnections: true,
  connectionLimit: 10,
});

async function connectMongoDB() {
  const uri = process.env.MONGODB_URI
    || `mongodb://${encodeURIComponent(requiredEnvironmentVariable('MONGODB_USER'))}:${encodeURIComponent(requiredEnvironmentVariable('MONGODB_PASSWORD'))}@${process.env.MONGODB_HOST || '127.0.0.1'}:${Number(process.env.MONGODB_PORT || 27017)}/${process.env.MONGODB_DATABASE || 'smart_doc_mongo_db'}?authSource=admin`;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB successfully');
}

const InvoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit_price: { type: Number, required: true },
  line_amount: { type: Number, required: true },
}, { _id: false });

const InvoicePayloadSchema = new mongoose.Schema({
  job_id: { type: Number, required: true, index: true },
  raw_llm_output: { type: String, required: true },
  created_at: { type: Date, default: Date.now, required: true },
  normalized_data: {
    invoice_number: { type: String },
    invoice_date: { type: Date },
    supplier_name: { type: String },
    subtotal: { type: Number },
    tax: { type: Number },
    total: { type: Number },
    Invoice_Item: { type: [InvoiceItemSchema], required: true },
  },
  confidence_scores: {
    overall: { type: Number, required: true },
    invoice_number: { type: Number },
    total: { type: Number },
    items: { type: Number },
  },
}, { collection: 'Invoice_payloads' });

const InvoicePayload = mongoose.models.InvoicePayload || mongoose.model('InvoicePayload', InvoicePayloadSchema);

module.exports = { mysqlPool, connectMongoDB, InvoicePayload };
