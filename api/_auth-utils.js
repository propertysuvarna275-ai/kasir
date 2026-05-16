const { Pool } = require("@neondatabase/serverless");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

let pool = null;
let usersSchemaReady = false;

function getPool() {
  if (!process.env.NEON_DATABASE_URL) {
    throw new Error("[AUTH] Variabel lingkungan NEON_DATABASE_URL tidak diatur!");
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  }
  return pool;
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("[AUTH] Variabel lingkungan JWT_SECRET tidak diatur!");
  }
  return process.env.JWT_SECRET;
}

function parseRequestBody(req) {
  // Di Vercel body bisa sudah berupa object, Buffer, atau string JSON.
  if (!req.body) return {};
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8") || "{}");
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body;
}

function hashPassword(password, salt = null) {
  const normalized = String(password || "").trim();
  if (!normalized) throw new Error("Sandi tidak boleh kosong");
  // Buat salt acak atau gunakan yang disediakan
  const saltBuffer = salt ? Buffer.from(salt, "hex") : crypto.randomBytes(16);
  const hashBuffer = crypto.pbkdf2Sync(normalized, saltBuffer, 100000, 64, "sha256");
  return { hash: hashBuffer.toString("hex"), salt: saltBuffer.toString("hex") };
}

function verifyPassword(password, expectedHash, salt) {
  try {
    const { hash: computedHash } = hashPassword(password, salt);
    const actual = Buffer.from(expectedHash, "hex");
    const candidate = Buffer.from(computedHash, "hex");
    if (actual.length !== candidate.length) return false;
    return crypto.timingSafeEqual(actual, candidate);
  } catch (error) {
    return false;
  }
}

function createToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "8h"
  });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

async function initUsersSchema() {
  try {
    // Buat tabel users jika belum ada
    console.log("[AUTH] Membuat tabel users jika tidak ada...");
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("[AUTH] Tabel users siap");

    // Seed admin default jika tabel kosong
    console.log("[AUTH] Cek jumlah user di database...");
    const result = await pool.query("SELECT COUNT(*) AS count FROM users");
    const userCount = Number(result.rows[0]?.count || 0);
    console.log("[AUTH] Total user di database:", userCount);
    
    if (userCount === 0) {
      console.log("[AUTH] Database kosong, membuat admin default...");
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
      console.log("[AUTH] Menggunakan password:", defaultPassword === "admin123" ? "DEFAULT (admin123)" : "CUSTOM");
      
      const { hash, salt } = hashPassword(defaultPassword);
      console.log("[AUTH] Hash dan salt berhasil dibuat");
      
      await pool.query(
        "INSERT INTO users (username, role, password_hash, password_salt) VALUES ($1, $2, $3, $4)",
        ["admin", "Admin", hash, salt]
      );
      console.log("[AUTH] Admin default berhasil dibuat");
    } else {
      console.log("[AUTH] Database sudah ada data, tidak perlu seed");
    }
  } catch (error) {
    console.error("[AUTH] Error initUsersSchema:", error.message);
    throw error;
  }
}

async function ensureUsersSchema() {
  if (!usersSchemaReady) {
    await initUsersSchema();
    usersSchemaReady = true;
  }
}

async function getUserByUsername(username) {
  try {
    console.log("[AUTH] Query user dari database:", username);
    const pool = getPool();
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [String(username).trim()]);
    console.log("[AUTH] Query result rows:", result.rows.length);
    if (result.rows.length > 0) {
      console.log("[AUTH] User ditemukan");
    }
    return result.rows[0] || null;
  } catch (error) {
    console.error("[AUTH] Error getUserByUsername:", error.message);
    throw error;
  }
}

module.exports = {
  getPool,
  ensureUsersSchema,
  parseRequestBody,
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  getUserByUsername
};
