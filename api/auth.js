const { ensureUsersSchema, parseRequestBody, getUserByUsername, verifyPassword, createToken } = require("./_auth-utils");

module.exports = async (req, res) => {
  console.log("[AUTH] Request dimulai pada:", new Date().toISOString());
  try {
    // Inisialisasi skema users
    console.log("[AUTH] Inisialisasi skema users...");
    await ensureUsersSchema();
    console.log("[AUTH] Skema users berhasil diinisialisasi");
    
    // Hanya terima POST
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: "Metode tidak diizinkan" });
    }

    // Parse request
    const body = parseRequestBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    console.log("[AUTH] Login attempt untuk username:", username);

    if (!username || !password) {
      console.log("[AUTH] Username atau password kosong");
      return res.status(400).json({ error: "Username dan sandi dibutuhkan." });
    }

    // Verifikasi user
    console.log("[AUTH] Mencari user:", username);
    const user = await getUserByUsername(username);
    
    if (!user) {
      console.log("[AUTH] User tidak ditemukan:", username);
      return res.status(401).json({ error: "Username atau sandi salah." });
    }

    console.log("[AUTH] User ditemukan, memverifikasi sandi...");
    const isPasswordValid = verifyPassword(password, user.password_hash, user.password_salt);
    
    if (!isPasswordValid) {
      console.log("[AUTH] Sandi tidak cocok untuk user:", username);
      return res.status(401).json({ error: "Username atau sandi salah." });
    }

    // Buat token JWT
    console.log("[AUTH] Sandi cocok, membuat JWT token untuk user:", username);
    const token = createToken({ username: user.username, role: user.role });
    console.log("[AUTH] Login berhasil untuk user:", username, "dengan role:", user.role);
    
    return res.status(200).json({ 
      user: { username: user.username, role: user.role }, 
      token 
    });
  } catch (error) {
    console.error("[AUTH] KESALAHAN:", error.message);
    console.error("[AUTH] Stack trace:", error.stack);
    return res.status(500).json({ 
      error: error.message || "Kesalahan server", 
      details: error.code,
      type: error.constructor.name 
    });
  }
};