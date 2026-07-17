

CREATE DATABASE IF NOT EXISTS urlshortener;
USE urlshortener;


CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,         -- bcrypt hashed, never plain text
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS links (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  short_code   VARCHAR(20) UNIQUE NOT NULL,  -- e.g. "abc123"
  original_url TEXT NOT NULL,
  clicks       INT DEFAULT 0,
  expires_at   DATETIME DEFAULT NULL,        -- optional expiry
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

);