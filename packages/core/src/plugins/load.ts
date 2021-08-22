import type {
  NamedLoksePlugin,
  PluginFactory,
  GeneralPluginOptions,
} from "./create";
import { PluginsRunner } from "./runner";

function loadPlugin(
  plugin: PluginName | PluginDefinition,
  options: GeneralPluginOptions
): NamedLoksePlugin | null {
  const pluginName = typeof plugin === "string" ? plugin : plugin.name;
  const pluginOptions =
    typeof plugin === "string" ? options : { ...options, ...plugin.options };

  try {
    const pluginFactory: PluginFactory = require(pluginName);
    const loadedPlugin = pluginFactory(pluginOptions);

    return {
      ...loadedPlugin,
      pluginName,
    };
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      options.logger.warn(
        `🔍 Unable to load plugin ${pluginName}. Is he installed?`
      );
    } else {
      options.logger.warn(
        `💥 Unexpected error occurred when loading plugin ${pluginName}:\n${error.message}`
      );
    }

    return null;
  }
}

type PluginName = string;
interface PluginDefinition {
  name: PluginName;
  options: object;
}

export function loadPlugins(
  plugins: (PluginName | PluginDefinition)[],
  options: GeneralPluginOptions
) {
  const loadedPlugins = plugins
    .map((plugin) => loadPlugin(plugin, options))
    .filter((plugin: unknown): plugin is NamedLoksePlugin => Boolean(plugin));

  return new PluginsRunner(loadedPlugins, options);
}
