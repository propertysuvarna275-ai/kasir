const { Pool } = require("@neondatabase/serverless");

module.exports = async (req, res) => {
  try {
    // Cek environment variables
    const envStatus = {
      NEON_DATABASE_URL: !!process.env.NEON_DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      DEFAULT_ADMIN_PASSWORD: !!process.env.DEFAULT_ADMIN_PASSWORD,
    };

    // Coba koneksi database
    const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
    const result = await pool.query("SELECT NOW() AS current_time");
    
    return res.status(200).json({
      status: "OK",
      environment: envStatus,
      database: {
        connected: true,
        time: result.rows[0].current_time
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[HEALTH] Error:", error.message);
    return res.status(500).json({
      status: "ERROR",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
