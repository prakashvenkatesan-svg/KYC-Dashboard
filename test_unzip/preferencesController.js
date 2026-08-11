const pool = require("./config/db");

const getPreferences = async (req, res) => {
  try {
    const { pageCode } = req.params;
    const userId = req.user.id;

    if (!pageCode) {
      return res.status(400).json({ success: false, message: "pageCode is required" });
    }

    const query = `
      SELECT visible_columns, column_order, sort_by, sort_order
      FROM public.user_table_preferences
      WHERE user_id = $1 AND page_code = $2
    `;
    const result = await pool.query(query, [userId, pageCode]);

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        visibleColumns: result.rows[0].visible_columns,
        columnOrder: result.rows[0].column_order,
        sortBy: result.rows[0].sort_by,
        sortOrder: result.rows[0].sort_order
      }
    });
  } catch (err) {
    console.error("Error fetching preferences:", err.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const savePreferences = async (req, res) => {
  try {
    const { pageCode } = req.params;
    const userId = req.user.id;
    const { visibleColumns, columnOrder, sortBy, sortOrder } = req.body;

    if (!pageCode || !visibleColumns || !columnOrder) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const query = `
      INSERT INTO public.user_table_preferences 
        (user_id, page_code, visible_columns, column_order, sort_by, sort_order, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, page_code) 
      DO UPDATE SET 
        visible_columns = EXCLUDED.visible_columns,
        column_order = EXCLUDED.column_order,
        sort_by = EXCLUDED.sort_by,
        sort_order = EXCLUDED.sort_order,
        updated_at = CURRENT_TIMESTAMP
      RETURNING visible_columns, column_order, sort_by, sort_order;
    `;
    
    const result = await pool.query(query, [
      userId, 
      pageCode, 
      JSON.stringify(visibleColumns), 
      JSON.stringify(columnOrder),
      sortBy || null,
      sortOrder || null
    ]);

    res.json({ success: true, message: "Preferences saved", data: result.rows[0] });
  } catch (err) {
    console.error("Error saving preferences:", err.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getPreferences,
  savePreferences
};
