const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/src/repositories/__tests__/backup_restore.integration.test.ts",
    "/dist/",
    "/src/repositories/__tests__/db_check.test.ts",
    "/src/repositories/__tests__/drawer_adjustments.test.ts",
    "/src/repositories/__tests__/reversal.test.ts",
    "/src/repositories/__tests__/shift_reconciliation.test.ts",
    "/src/repositories/__tests__/reversal_setup.ts",
    "/src/repositories/__tests__/purchase_integration.test.ts"
  ]
};