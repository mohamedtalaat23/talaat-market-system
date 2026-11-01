const { createDefaultPreset } = require('ts-jest');

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import('jest').Config} **/
module.exports = {
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/runtime-stage/'],
  transform: {
    ...tsJestTransformCfg,
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/release/'],
};
