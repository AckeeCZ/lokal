import { reduce } from "bluebird";

import type {
  LoksePlugin,
  NamedLoksePlugin,
  GeneralPluginOptions,
} from "./create";

export class PluginsRunner {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    public plugins: NamedLoksePlugin[],
    private options: GeneralPluginOptions
  ) {}

  async runHook<
    K extends keyof LoksePlugin,
    T extends Parameters<LoksePlugin[K]>[0]
  >(
    hookName: K,
    unprocessedTarget: T,
    meta: Parameters<LoksePlugin[K]>[1]
  ): Promise<T> {
    const target = await reduce(
      this.plugins,
      async (target, plugin) => {
        const hook = plugin[hookName] as any;

        try {
          const transformedTarget = await hook(target, meta);
          return transformedTarget;
        } catch (error) {
          this.options.logger.warn(
            `Error when running hook ${hookName} of plugin ${plugin.pluginName}: ${error.message}`
          );
          return target;
        }
      },
      unprocessedTarget
    );

    return target;
  }
}
