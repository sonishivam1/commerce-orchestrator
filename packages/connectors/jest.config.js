/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/__tests__/**/*.spec.ts'],
  // node-fetch v3 is ESM-only; tests use jest.mock('node-fetch', () => jest.fn())
  // factory so the module is never actually loaded (factory intercepts first).
  transformIgnorePatterns: [
    '/node_modules/(?!node-fetch)',
  ],
};
