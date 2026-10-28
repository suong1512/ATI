import mongoose from "mongoose";
import { createPool, type Pool } from "mysql2/promise";

type DatabaseGlobals = typeof globalThis & {
  mysqlPool?: Pool;
  mongoConnection?: Promise<typeof mongoose>;
};

const databaseGlobals = globalThis as DatabaseGlobals;

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getMysqlPool() {
  if (!databaseGlobals.mysqlPool) {
    databaseGlobals.mysqlPool = createPool({
      host: requiredEnvironmentVariable("MYSQL_HOST"),
      port: Number(requiredEnvironmentVariable("MYSQL_PORT")),
      user: requiredEnvironmentVariable("MYSQL_USER"),
      password: requiredEnvironmentVariable("MYSQL_PASSWORD"),
      database: requiredEnvironmentVariable("MYSQL_DATABASE"),
      waitForConnections: true,
      connectionLimit: 10,
      timezone: "Z",
    });
  }

  return databaseGlobals.mysqlPool;
}

export async function connectMongoDatabase() {
  if (!databaseGlobals.mongoConnection) {
    databaseGlobals.mongoConnection = mongoose
      .connect(requiredEnvironmentVariable("MONGODB_URI"), {
        serverSelectionTimeoutMS: 5000,
      })
      .catch((error: unknown) => {
        databaseGlobals.mongoConnection = undefined;
        throw error;
      });
  }

  await databaseGlobals.mongoConnection;
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error("MongoDB connected without an active database.");
  }

  return database;
}
