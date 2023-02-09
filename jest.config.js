module.exports = {
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: ["<rootDir>/packages/*/src/**/__tests__/**/*.test.ts"],
  transform: {
    "\\.ts$": "ts-jest",
  },
  coverageReporters: ["lcov", "text-summary"],
  collectCoverageFrom: ["packages/*/src/**/*.ts"],
  coveragePathIgnorePatterns: ["/templates/"],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  globals: {
    "ts-jest": {
      diagnostics: { warnOnly: true },
    },
  },
  resolver: "<rootDir>/test-utils/resolver",
};
