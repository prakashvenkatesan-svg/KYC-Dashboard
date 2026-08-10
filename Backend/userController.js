const pool = require("./config/db");
const bcrypt = require("bcryptjs");

const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email_id, mobile_number, username, role, account_status, assigned_modules, created_at, last_login 
       FROM public.kyc_admin_users ORDER BY id ASC`
    );
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ success: false, message: "Error fetching users" });
  }
};

const createUser = async (req, res) => {
  try {
    const { full_name, email_id, mobile_number, username, password, role, account_status, assigned_modules } = req.body;
    
    // Validate
    if (!full_name || !username || !password || !role) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO public.kyc_admin_users (full_name, email_id, mobile_number, username, password_hash, role, account_status, assigned_modules)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username`,
      [full_name, email_id, mobile_number, username, password_hash, role, account_status || 'Active', JSON.stringify(assigned_modules || [])]
    );

    return res.status(201).json({ success: true, message: "User created successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: "Username or Email already exists" });
    }
    return res.status(500).json({ success: false, message: "Error creating user" });
  }
};

const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { full_name, email_id, mobile_number, role, account_status, assigned_modules, password } = req.body;

    let query = `UPDATE public.kyc_admin_users SET 
                 full_name = $1, email_id = $2, mobile_number = $3, 
                 role = $4, account_status = $5, assigned_modules = $6`;
    let params = [full_name, email_id, mobile_number, role, account_status, JSON.stringify(assigned_modules)];
    let paramIndex = 7;

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      query += `, password_hash = $${paramIndex}`;
      params.push(password_hash);
      paramIndex++;
    }

    query += ` WHERE id = $${paramIndex} RETURNING id`;
    params.push(userId);

    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ success: false, message: "Error updating user" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prevent self deletion
    if (parseInt(userId) === req.user.userId) {
      return res.status(400).json({ success: false, message: "Cannot delete your own account" });
    }

    const result = await pool.query(`DELETE FROM public.kyc_admin_users WHERE id = $1`, [userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete user", error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, mobile_number, password } = req.body;

    let query = `UPDATE public.kyc_admin_users SET full_name = $1, mobile_number = $2`;
    let params = [full_name, mobile_number];

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      query += `, password_hash = $3`;
      params.push(password_hash);
    }

    query += ` WHERE id = $${params.length + 1} RETURNING id, full_name, mobile_number`;
    params.push(userId);

    const result = await pool.query(query, params);
    return res.status(200).json({ success: true, data: result.rows[0], message: "Profile updated successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update profile", error: error.message });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  updateProfile
};
