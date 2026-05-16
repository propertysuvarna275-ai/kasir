const { verifyToken, getPool } = require("./_auth-utils");

let schemaReady = false;

async function initSchema() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      queue TEXT UNIQUE NOT NULL,
      customer TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      payment TEXT NOT NULL,
      total BIGINT NOT NULL,
      started BIGINT NOT NULL,
      items JSONB NOT NULL,
      notes TEXT
    );
  `);
}

async function ensureSchema() {
  if (!schemaReady) {
    await initSchema();
    schemaReady = true;
  }
}

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body);
  return req.body;
}

async function getNextQueueNumber() {
  const pool = getPool();
  const result = await pool.query(
    "SELECT COALESCE(MAX((regexp_replace(queue, '[^0-9]', '', 'g'))::int), 0) AS max_queue FROM orders"
  );
  return Number(result.rows[0]?.max_queue || 0) + 1;
}

function formatOrder(row) {
  return {
    queue: row.queue,
    customer: row.customer,
    type: row.type,
    status: row.status,
    payment: row.payment,
    total: Number(row.total),
    started: Number(row.started),
    items: row.items,
    notes: row.notes || ""
  };
}

module.exports = async (req, res) => {
  try {
    await ensureSchema();

    // Validasi Bearer token
    const authHeader = String(req.headers.authorization || "");
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Tidak diizinkan" });
    }
    try {
      verifyToken(authHeader.slice(7));
    } catch (error) {
      return res.status(401).json({ error: "Token tidak valid" });
    }

    // GET: Ambil semua order
    if (req.method === "GET") {
      const pool = getPool();
      const result = await pool.query("SELECT * FROM orders ORDER BY started DESC");
      const orders = result.rows.map(formatOrder);
      const nextOrderNum = await getNextQueueNumber();
      return res.status(200).json({ orders, nextOrderNum });
    }

    // POST: Buat order baru
    if (req.method === "POST") {
      const body = parseRequestBody(req);
      const customer = String(body.customer || "Pelanggan Walk-in").trim();
      const type = String(body.type || "Dine In").trim();
      const status = String(body.status || "Order Baru").trim();
      const payment = String(body.payment || "Tunai").trim();
      const total = Number(body.total || 0);
      const started = Number(body.started || Date.now());
      const items = Array.isArray(body.items) ? body.items : [];
      const notes = String(body.notes || "").trim();

      if (!customer || !payment || !items.length || total <= 0) {
        return res.status(400).json({ error: "Payload order tidak valid." });
      }

      const pool = getPool();
      const nextNum = await getNextQueueNumber();
      const queue = `SD${String(nextNum).padStart(3, "0")}`;
      const insert = await pool.query(
        "INSERT INTO orders (queue, customer, type, status, payment, total, started, items, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
        [queue, customer, type, status, payment, total, started, JSON.stringify(items), notes]
      );

      const order = formatOrder(insert.rows[0]);
      return res.status(201).json({ order, nextOrderNum: nextNum + 1 });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Metode tidak diizinkan" });
  } catch (error) {
    console.error("[API] Kesalahan order:", error);
    return res.status(500).json({ error: "Kesalahan server" });
  }
};
