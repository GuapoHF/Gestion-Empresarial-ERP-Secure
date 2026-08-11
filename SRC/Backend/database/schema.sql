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

SELECT
    id,
    first_name,
    last_name,
    second_last_name,
    email,
    username,
    company,
    role
FROM users
WHERE
    username = ?
    AND password = ?;