const { getPool, ensureUsersSchema, parseRequestBody, verifyToken, verifyPassword, hashPassword, getUserByUsername } = require("./_auth-utils");

module.exports = async (req, res) => {
  try {
    await ensureUsersSchema();

    // Validasi Bearer token
    const authHeader = String(req.headers.authorization || "");
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Tidak diizinkan" });
    }

    // Verifikasi token JWT
    let session;
    try {
      session = verifyToken(authHeader.slice(7));
    } catch (error) {
      return res.status(401).json({ error: "Token tidak valid" });
    }

    // GET: Daftar semua user (admin only)
    if (req.method === "GET") {
      if (session.role !== "Admin") {
        return res.status(403).json({ error: "Akses ditolak" });
      }
      const pool = getPool();
      const result = await pool.query("SELECT username, role FROM users ORDER BY username ASC");
      return res.status(200).json({ users: result.rows });
    }

    // PUT: Ubah sandi user
    if (req.method === "PUT") {
      const body = parseRequestBody(req);
      const targetUsername = String(body.username || session.username).trim();
      const newPassword = String(body.newPassword || "").trim();
      const oldPassword = String(body.oldPassword || "").trim();

      if (!newPassword) {
        return res.status(400).json({ error: "Sandi baru tidak boleh kosong." });
      }

      const targetUser = await getUserByUsername(targetUsername);
      if (!targetUser) {
        return res.status(404).json({ error: "Pengguna tidak ditemukan." });
      }

      // Cek izin: hanya admin atau user sendiri yang bisa ubah
      if (targetUsername !== session.username && session.role !== "Admin") {
        return res.status(403).json({ error: "Akses ditolak" });
      }

      // Jika user mengubah sandi sendiri, perlu verifikasi sandi lama
      if (targetUsername === session.username) {
        if (!oldPassword || !verifyPassword(oldPassword, targetUser.password_hash, targetUser.password_salt)) {
          return res.status(401).json({ error: "Sandi lama salah." });
        }
      }

      // Update sandi baru
      const { hash, salt } = hashPassword(newPassword);
      const pool = getPool();
      await pool.query("UPDATE users SET password_hash = $1, password_salt = $2 WHERE username = $3", [hash, salt, targetUsername]);
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ error: "Metode tidak diizinkan" });
  } catch (error) {
    console.error("[AUTH] Kesalahan:", error);
    return res.status(500).json({ error: "Kesalahan server" });
  }
};