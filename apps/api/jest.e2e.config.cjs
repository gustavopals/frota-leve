/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.e2e-spec.ts'],
  moduleNameMapper: {
    '^@frota-leve/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@frota-leve/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  setupFiles: ['<rootDir>/src/test/setup.ts'],
};
