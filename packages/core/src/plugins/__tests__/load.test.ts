const generalOptions = {
    logger: {
        warn: jest.fn(),
        log: jest.fn(),
    },
};

const plugin1Factory = jest.fn();
const plugin2Factory = jest.fn();
const plugin3Factory = jest.fn();

jest.doMock('@lokse/plugin1', () => plugin1Factory, {
    virtual: true,
});
jest.doMock('@lokse/plugin2', () => plugin2Factory, {
    virtual: true,
});
jest.doMock('@lokse/plugin3', () => plugin3Factory, {
    virtual: true,
});

import { loadPlugins, PluginError } from '../load';

describe('loadPlugins', () => {
    const generalMeta = { languages: [] };
    const plugin1Matcher = expect.objectContaining({ id: 'plugin1' });
    const plugin2Matcher = expect.objectContaining({ id: 'plugin2' });
    const plugin3Matcher = expect.objectContaining({ id: 'plugin3' });

    beforeEach(() => {
        plugin1Factory.mockReset().mockReturnValue({ id: 'plugin1' });
        plugin2Factory.mockReset().mockReturnValue({ id: 'plugin2' });
        plugin3Factory.mockReset().mockReturnValue({ id: 'plugin3' });
        generalOptions.logger.warn.mockClear();
        generalOptions.logger.log.mockClear();
    });

    it('should log error and return empty list when plugins is not an array', () => {
        expect(loadPlugins('' as any, generalOptions, generalMeta).plugins).toEqual([]);
        expect(generalOptions.logger.warn).toHaveBeenCalledWith(expect.stringMatching('Plugins list must be an array'));
    });

    it('should load plugins by name', () => {
        const plugins = ['@lokse/plugin1', '@lokse/plugin2'];

        expect(loadPlugins(plugins, generalOptions, generalMeta).plugins).toEqual([plugin1Matcher, plugin2Matcher]);
        expect(plugin1Factory).toHaveBeenCalled();
        expect(plugin1Factory).toHaveBeenCalledWith(generalOptions, generalMeta);
        expect(plugin2Factory).toHaveBeenCalled();
        expect(plugin2Factory).toHaveBeenCalledWith(generalOptions, generalMeta);
    });

    it('should load plugins by full definition', () => {
        const plugin2Options = { test: 'test2' };
        const plugin3Options = { test: 'test3' };
        const plugins = [
            { name: '@lokse/plugin2', options: plugin2Options },
            { name: '@lokse/plugin3', options: plugin3Options },
        ];

        expect(loadPlugins(plugins, generalOptions, generalMeta).plugins).toEqual([plugin2Matcher, plugin3Matcher]);
        expect(plugin2Factory).toHaveBeenCalled();
        expect(plugin2Factory).toHaveBeenCalledWith(
            {
                ...generalOptions,
                ...plugin2Options,
            },
            generalMeta,
        );
        expect(plugin3Factory).toHaveBeenCalled();
        expect(plugin3Factory).toHaveBeenCalledWith(
            {
                ...generalOptions,
                ...plugin3Options,
            },
            generalMeta,
        );
    });

    it('should load all plugins mixed names and definitions', () => {
        const pluginOptions = { test: 'test' };
        const plugins = [{ name: '@lokse/plugin1', options: pluginOptions }, '@lokse/plugin3'];

        expect(loadPlugins(plugins, generalOptions, generalMeta).plugins).toEqual([plugin1Matcher, plugin3Matcher]);
        expect(plugin1Factory).toHaveBeenCalled();
        expect(plugin1Factory).toHaveBeenCalledWith(
            {
                ...generalOptions,
                ...pluginOptions,
            },
            generalMeta,
        );
        expect(plugin3Factory).toHaveBeenCalled();
        expect(plugin3Factory).toHaveBeenCalledWith(generalOptions, generalMeta);
    });

    it('should log plugins that were unable to find and load others', () => {
        const plugins = ['@lokse/plugin1', '@lokse/plugin1.5', '@lokse/plugin2', '@lokse/plugin4'];

        expect(loadPlugins(plugins, generalOptions, generalMeta).plugins).toEqual([plugin1Matcher, plugin2Matcher]);
        expect(generalOptions.logger.warn).toHaveBeenCalledTimes(2);
        expect(generalOptions.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/Unable to load/));
    });

    it('should log known plugin errors that occurr during initialization', () => {
        plugin1Factory.mockImplementation(() => {
            throw new PluginError('Plugin 1 requires options');
        });
        plugin2Factory.mockImplementation(() => {
            throw new PluginError('Plugin 2 contains error');
        });
        const plugins = ['@lokse/plugin1', '@lokse/plugin2', '@lokse/plugin3'];

        expect(loadPlugins(plugins, generalOptions, generalMeta).plugins).toEqual([plugin3Matcher]);
        expect(generalOptions.logger.warn).toHaveBeenCalledTimes(2);
        expect(generalOptions.logger.warn).toHaveBeenCalledWith(
            expect.stringMatching('cannot been loaded: Plugin 1 requires options'),
        );
        expect(generalOptions.logger.warn).toHaveBeenCalledWith(
            expect.stringMatching('cannot been loaded: Plugin 2 contains error'),
        );
    });

    it('should log unknown errors that occurred during its initialization', () => {
        plugin1Factory.mockImplementation(() => {
            throw new Error('Plugin 1 requires options');
        });
        plugin2Factory.mockImplementation(() => {
            throw new Error('Plugin 2 contains error');
        });
        const plugins = ['@lokse/plugin1', '@lokse/plugin2', '@lokse/plugin3'];

        expect(loadPlugins(plugins, generalOptions, generalMeta).plugins).toEqual([plugin3Matcher]);
        expect(generalOptions.logger.warn).toHaveBeenCalledTimes(2);
        expect(generalOptions.logger.warn).toHaveBeenCalledWith(
            expect.stringMatching(
                'Unexpected error occurred when loading plugin @lokse/plugin1:\nPlugin 1 requires options',
            ),
        );
        expect(generalOptions.logger.warn).toHaveBeenCalledWith(
            expect.stringMatching(
                'Unexpected error occurred when loading plugin @lokse/plugin2:\nPlugin 2 contains error',
            ),
        );
    });

    it('assign name to every loaded plugin', () => {
        const plugins = ['@lokse/plugin1', { name: '@lokse/plugin2', options: {} }];

        const { plugins: loadedPlugins } = loadPlugins(plugins, generalOptions, generalMeta);

        expect(loadedPlugins[0]).toHaveProperty('pluginName', '@lokse/plugin1');
        expect(loadedPlugins[1]).toHaveProperty('pluginName', '@lokse/plugin2');
    });
});
