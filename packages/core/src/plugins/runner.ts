import blubird from 'bluebird';
import { getErrorMessage } from '../errors.js';

import type { LoksePlugin, NamedLoksePlugin, GeneralPluginOptions } from './create.js';

const { reduce } = blubird;

export class PluginsRunner {
    // eslint-disable-next-line no-useless-constructor
    constructor(
        public plugins: NamedLoksePlugin[],
        private options: GeneralPluginOptions,
    ) {}

    async runHook<K extends keyof LoksePlugin, T extends Parameters<LoksePlugin[K]>[0]>(
        hookName: K,
        unprocessedTarget: T,
        meta: Parameters<LoksePlugin[K]>[1],
    ): Promise<T> {
        const target = await reduce(
            this.plugins,
            async (target, plugin) => {
                const hook = plugin[hookName] as any;

                try {
                    const transformedTarget = await hook(target, meta);
                    return transformedTarget;
                } catch (error) {
                    const { pluginName } = plugin;
                    const errorMsg = getErrorMessage(error);

                    this.options.logger.warn(
                        `Error when running hook ${hookName} of plugin ${pluginName}: ${errorMsg}`,
                    );
                    return target;
                }
            },
            unprocessedTarget,
        );

        return target;
    }
}
