const express = require("express");
const {
  getDashboardSummary,
  getClients,
  getClientByCode,
  getIntegrationRecords
} = require("./kycDashboardController");

const {
  loginUser,
  verifyTokenMiddleware,
  requireAdminMiddleware,
  requireModulePermission
} = require("./authController");

const {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser
} = require("./userController");

const router = express.Router();

router.post("/login", loginUser);

// Apply auth middleware to all routes below this line
router.use(verifyTokenMiddleware);

router.get("/summary", requireModulePermission("Dashboard"), getDashboardSummary);
router.get("/clients", requireModulePermission("Clients"), getClients);
router.get("/clients/:clientCode", requireModulePermission("Clients"), getClientByCode);
router.get("/integrations/:integrationName", getIntegrationRecords);

// User Management Routes (Admin Only)
router.get("/users", requireAdminMiddleware, getAllUsers);
router.post("/users", requireAdminMiddleware, createUser);
router.put("/users/:id", requireAdminMiddleware, updateUser);
router.delete("/users/:id", requireAdminMiddleware, deleteUser);

module.exports = router;
