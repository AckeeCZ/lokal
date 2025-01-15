import { vi, describe, it, beforeEach, afterAll, expect } from 'vitest';

const mockExplorer = {
    search: vi.fn(),
};

vi.mock('cosmiconfig', () => {
    return {
        cosmiconfig: vi.fn().mockReturnValue(mockExplorer),
    };
});

describe('getConfig', async () => {
    const OLD_ENV = process.env;
    const searchMock = mockExplorer.search;
    const { getConfig } = await import('../config.js');

    beforeEach(() => {
        searchMock.mockReset();
        // https://stackoverflow.com/a/48042799/7051731
        vi.resetModules();
        process.env = { ...OLD_ENV }; // Make a copy
    });

    afterAll(() => {
        process.env = OLD_ENV; // Restore old environment
    });

    it('should return config loaded from cwd', async () => {
        await getConfig();

        expect(searchMock).toHaveBeenCalledTimes(1);
        expect(searchMock).toHaveBeenCalledWith(undefined);
    });

    it('should return config loaded from custom path provided via env variable', async () => {
        process.env.LOKSE_CONFIG_PATH = '/path/from/variable';

        await getConfig();

        expect(searchMock).toHaveBeenCalledTimes(1);
        expect(searchMock).toHaveBeenCalledWith('/path/from/variable');
    });

    it('should return config loaded from custom path provided via custom path', () => {
        getConfig('/custom/path');

        expect(searchMock).toHaveBeenCalledTimes(1);
        expect(searchMock).toHaveBeenCalledWith('/custom/path');
    });
});
