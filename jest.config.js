module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 85,
      functions: 85,
      lines: 85
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/mocks/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/']
};
