const express = require("express");
const {
  getDashboardSummary,
  getClients,
  getClientByCode,
  getClientById,
  getClientKycStages,
  getIntegrationRecords,
  getPayments,
  getStageTimestamps
} = require("./kycDashboardController");

const { 
  loginUser, 
  verifyTokenMiddleware, 
  requireAdminMiddleware 
} = require("./authController");

const { 
  getAllUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  updateProfile 
} = require("./userController");

const {
  skipPaymentAction,
  stepBackAction,
  changeStepAction
} = require("./kycJourneyController");

const router = express.Router();

// Public Routes
router.post("/login", loginUser);

// Profile Route
router.put("/profile", verifyTokenMiddleware, updateProfile);

// User Management Routes (Admin Only)
router.get("/users", verifyTokenMiddleware, requireAdminMiddleware, getAllUsers);
router.post("/users", verifyTokenMiddleware, requireAdminMiddleware, createUser);
router.put("/users/:id", verifyTokenMiddleware, requireAdminMiddleware, updateUser);
router.delete("/users/:id", verifyTokenMiddleware, requireAdminMiddleware, deleteUser);

// Dashboard Routes (Requires Authentication)
router.get("/summary", verifyTokenMiddleware, getDashboardSummary);
router.get("/clients", verifyTokenMiddleware, getClients);
router.get("/clients/:clientCode", verifyTokenMiddleware, getClientByCode);
router.get("/clients/:clientCode/stage-timestamps", verifyTokenMiddleware, getStageTimestamps);
router.get("/kyc-applications/:applicationId/details", verifyTokenMiddleware, getClientById);
router.get("/kyc-applications/:applicationId/stages", verifyTokenMiddleware, getClientKycStages);
router.get("/integrations/:integrationName", verifyTokenMiddleware, getIntegrationRecords);
router.get("/payments", verifyTokenMiddleware, getPayments);

router.post("/clients/:clientCode/skip-payment", verifyTokenMiddleware, requireAdminMiddleware, skipPaymentAction);
router.put("/clients/:clientCode/skip-payment", verifyTokenMiddleware, requireAdminMiddleware, skipPaymentAction);
router.post("/clients/:clientCode/step-back", verifyTokenMiddleware, requireAdminMiddleware, stepBackAction);
router.put("/clients/:clientCode/step-back", verifyTokenMiddleware, requireAdminMiddleware, stepBackAction);
router.post("/kyc-applications/:applicationId/skip-payment", verifyTokenMiddleware, requireAdminMiddleware, skipPaymentAction);
router.put("/kyc-applications/:applicationId/skip-payment", verifyTokenMiddleware, requireAdminMiddleware, skipPaymentAction);
router.post("/kyc-applications/:applicationId/step-back", verifyTokenMiddleware, requireAdminMiddleware, stepBackAction);
router.put("/kyc-applications/:applicationId/step-back", verifyTokenMiddleware, requireAdminMiddleware, stepBackAction);
router.post("/kyc-applications/:applicationId/stages", verifyTokenMiddleware, requireAdminMiddleware, changeStepAction);
router.put("/kyc-applications/:applicationId/stages", verifyTokenMiddleware, requireAdminMiddleware, changeStepAction);

module.exports = router;
