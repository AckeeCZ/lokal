import { getErrorMessage } from '../errors';
import type { NamedLoksePlugin, PluginFactory, GeneralPluginOptions, GeneralPluginMeta } from './create';
import { PluginsRunner } from './runner';

export class PluginError extends Error {}

async function loadPlugin(
    plugin: PluginName | PluginDefinition,
    options: GeneralPluginOptions,
    meta: GeneralPluginMeta,
): Promise<NamedLoksePlugin | null> {
    const pluginName = typeof plugin === 'string' ? plugin : plugin.name;
    const pluginOptions = typeof plugin === 'string' ? options : { ...options, ...plugin.options };

    try {
        const pluginFactory: PluginFactory = await import(pluginName).then(v => v.default);
        const loadedPlugin = pluginFactory(pluginOptions, meta);

        return {
            ...loadedPlugin,
            pluginName,
        };
    } catch (error) {
        if ((error as Error).message.includes('Failed to load')) {
            options.logger.warn(`🔍 LUnable to load plugin ${pluginName}. Is it installed?`);
        } else if (error instanceof PluginError) {
            options.logger.warn(`🙅 Plugin ${pluginName} cannot been loaded: ${error.message}`);
        } else {
            options.logger.warn(
                `💥 Unexpected error occurred when loading plugin ${pluginName}:\n${getErrorMessage(error)}`,
            );
        }

        return null;
    }
}

export type PluginName = string;
export interface PluginDefinition {
    name: PluginName;
    options: Record<string, any>;
}

export async function loadPlugins(
    plugins: (PluginName | PluginDefinition)[] | unknown,
    options: GeneralPluginOptions,
    meta: GeneralPluginMeta,
): Promise<PluginsRunner> {
    let loadedPlugins: NamedLoksePlugin[];

    if (Array.isArray(plugins)) {
        const pluginPromises = await Promise.all(plugins.map(plugin => loadPlugin(plugin, options, meta)));
        loadedPlugins = pluginPromises.filter((plugin: unknown): plugin is NamedLoksePlugin => Boolean(plugin));
    } else {
        options.logger.warn(`Plugins list must be an array, got ${typeof plugins}`);
        loadedPlugins = [];
    }

    return new PluginsRunner(loadedPlugins, options);
}
