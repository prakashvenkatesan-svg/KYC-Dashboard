const pool = require("./config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET || 'aionion-kyc-super-secret-key';

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    // Auto-create table and default admin user if it doesn't exist yet
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.admin_users (
          id SERIAL PRIMARY KEY,
          full_name VARCHAR(100) NOT NULL,
          email_id VARCHAR(100) UNIQUE NOT NULL,
          mobile_number VARCHAR(15),
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'User',
          account_status VARCHAR(20) NOT NULL DEFAULT 'Active',
          assigned_modules JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP WITH TIME ZONE
      );
      
      INSERT INTO public.admin_users (full_name, email_id, mobile_number, username, password_hash, role, assigned_modules)
      SELECT 'Super Admin', 'admin@aionioncapital.com', '0000000000', 'admin', 
             '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGTRsyvwxBgC31Lgq', 
             'Admin', 
             '["Dashboard", "Clients", "NSE", "BSE", "CVL KRA", "CDSL", "TechExcel", "User Management"]'
      WHERE NOT EXISTS (
          SELECT id FROM public.admin_users WHERE username = 'admin'
      );
    `);

    const result = await pool.query(
      `SELECT id, full_name, email_id, username, password_hash, role, account_status, assigned_modules 
       FROM public.admin_users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (user.account_status !== 'Active') {
      return res.status(403).json({ success: false, message: "Account is inactive. Please contact the administrator." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Update last login
    await pool.query(`UPDATE public.admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]);

    // Generate JWT
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      modules: user.assigned_modules || []
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
        modules: user.assigned_modules
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Internal server error during login", error: error.message });
  }
};

const verifyTokenMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized: Token missing or invalid" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach payload to request
    next();
  } catch (err) {
    console.error("JWT Verification failed:", err.message);
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired token" });
  }
};

const requireAdminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    next();
  } else {
    return res.status(403).json({ success: false, message: "Forbidden: Admin access required" });
  }
};

const requireModulePermission = (moduleName) => {
  return (req, res, next) => {
    if (req.user && req.user.role === 'Admin') {
      return next(); // Admins have full access
    }
    
    if (req.user && req.user.modules && req.user.modules.includes(moduleName)) {
      return next();
    }

    return res.status(403).json({ success: false, message: `Forbidden: Access to ${moduleName} module is denied` });
  };
};

module.exports = {
  loginUser,
  verifyTokenMiddleware,
  requireAdminMiddleware,
  requireModulePermission
};
