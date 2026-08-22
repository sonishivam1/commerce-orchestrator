/** @type {import('ts-jest').JestConfigWithTsJest} */
const path = require('path');
const root = path.resolve(__dirname, '../..');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/__tests__/**/*.spec.ts'],
  moduleNameMapper: {
    '^@cdo/shared$': path.join(root, 'packages/shared/src/index.ts'),
    '^@cdo/core$': path.join(root, 'packages/core/src/index.ts'),
    '^@cdo/db$': path.join(root, 'packages/db/src/index.ts'),
    '^@cdo/connectors$': path.join(root, 'packages/connectors/src/index.ts'),
    '^@cdo/queue$': path.join(root, 'packages/queue/src/index.ts'),
    '^@cdo/redis$': path.join(root, 'packages/redis/src/index.ts'),
    '^@cdo/auth$': path.join(root, 'packages/auth/src/index.ts'),
  },
};
