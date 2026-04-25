module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: false,
  testMatch: [
    '<rootDir>/packages/**/src/**/*.test.ts',
    '<rootDir>/packages/**/src/**/*.spec.ts',
  ],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/packages/core/tsconfig.json',
    },
  },
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    '!packages/**/src/**/*.d.ts'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '<rootDir>/tests/', '<rootDir>/src/']
};
