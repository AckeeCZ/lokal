import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['packages/**/*.{test,spec}.ts'],
        coverage: {
            enabled: true,
            thresholds: {
                branches: 100,
                functions: 100,
                lines: 100,
                statements: 100,
            },
            reporter: ['lcov', 'text-summary'],
        },
        outputFile: 'coverage/sonar-report.xml',
        disableConsoleIntercept: true,

        testTimeout: 10_000,
    },
});
