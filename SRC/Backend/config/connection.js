const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",      // Usuario por defecto de XAMPP
  password: "",      // Contraseña por defecto de XAMPP (vacía)
  database: "textiles_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
module.exports = pool;