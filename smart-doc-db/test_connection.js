const mongoose = require('mongoose');
const { mysqlPool, connectMongoDB } = require('./db');

async function testPolyglotDatabase() {
  try {
    console.log('Checking MariaDB and MongoDB connections...');
    await mysqlPool.query('SELECT 1');
    console.log('MariaDB connection successful.');
    await connectMongoDB();

    const [jobs] = await mysqlPool.execute(`
      SELECT
        j.job_id, j.status, j.agreement_score, j.mongo_payload_id,
        d.file_name, u.name AS uploaded_by, m.model_name
      FROM Processing_Job j
      JOIN Document d ON j.document_id = d.document_id
      JOIN User u ON d.user_id = u.user_id
      JOIN Model_Configuration m ON j.configuration_id = m.configuration_id
    `);
    const database = mongoose.connection.db;
    if (!database) {
      throw new Error('MongoDB connected without an active database.');
    }

    const collection = database.collection('Invoice_payloads');
    console.log(`Found ${jobs.length} processing jobs.`);
    for (const job of jobs) {
      const mongoDoc = job.mongo_payload_id
        ? await collection.findOne({ _id: new mongoose.Types.ObjectId(job.mongo_payload_id) })
        : null;
      console.log({
        jobId: job.job_id,
        status: job.status,
        fileName: job.file_name,
        model: job.model_name,
        hasMongoPayload: Boolean(mongoDoc),
      });
    }
    console.log('Database connection test completed successfully.');
  } finally {
    await mysqlPool.end();
    await mongoose.disconnect();
  }
}

testPolyglotDatabase().catch((error) => {
  console.error('Database connection test failed:', error);
  process.exitCode = 1;
});
