const mysql = require("mysql2/promise");
require("dotenv").config();

// Creates a fresh MySQL connection every time it's called.
// No connection pool — simpler to understand for a student project.
// Always call conn.end() after your query to close it.
const getConnection = async () => {
  const connection = await mysql.createConnection({
    host    : process.env.DB_HOST,
    port    : 3306,
    user    : process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  return connection;
};

module.exports = getConnection;