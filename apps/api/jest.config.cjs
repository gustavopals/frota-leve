/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@frota-leve/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@frota-leve/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/types/**',
  ],
  setupFiles: ['<rootDir>/src/test/setup.ts'],
};
