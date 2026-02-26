const nextJest = require('next/jest')

// Providing the path to your Next.js app to load next.config.js and .env files in your test environment
const createJestConfig = nextJest({
  dir: './',
})

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Keep Jest resolution explicit and aligned with tsconfig paths.
  moduleDirectories: ['node_modules', '<rootDir>'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  testEnvironment: 'jest-environment-jsdom',

  // Keep Playwright suites out of Jest runs.
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
    '<rootDir>/test/e2e/',
    '<rootDir>/tests/',
    '<rootDir>/tests-examples/',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
