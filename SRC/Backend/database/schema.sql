CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  second_last_name TEXT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Administrador',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (first_name, last_name, second_last_name, email, username, password, company, role)
VALUES ('Gabriel', 'Hernandez', 'Morales', 'gabriel.hernandez@textilesgh.com', 'gabrielh', '12345678', 'Textiles GH', 'Administrador')
ON CONFLICT(username) DO NOTHING;

INSERT INTO users (first_name, last_name, second_last_name, email, username, password, company, role)
VALUES ('Mariana', 'Lopez', 'Santos', 'mariana.lopez@textilesgh.com', 'marianal', '12345678', 'Textiles GH', 'Empleado')
ON CONFLICT(username) DO NOTHING;

SELECT id, first_name, last_name, second_last_name, email, username, company, role
FROM users
WHERE username = ? AND password = ?;
