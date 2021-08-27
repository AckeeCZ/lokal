import { identity } from "lodash";

import Line from "../line";
import type { Logger } from "../logger";
import type Transformer from "../transformer";

export interface TransformLineMeta {
  language: string;
  domain?: string;
}

export interface TransformFullOutputMeta {
  transformer: Transformer;
  language: string;
  domain?: string;
}

export interface LoksePlugin {
  transformLine: (line: Line, meta: TransformLineMeta) => Line | Promise<Line>;
  transformFullOutput: (
    output: string,
    meta: TransformFullOutputMeta
  ) => string | Promise<string>;
}

export interface NamedLoksePlugin extends LoksePlugin {
  pluginName: string;
}

export interface GeneralPluginOptions {
  logger: Logger;
}

export type PluginFactory = (options: GeneralPluginOptions) => LoksePlugin;

const pluginDefaults: LoksePlugin = {
  transformLine: identity,
  transformFullOutput: identity,
};

export function createPlugin(plugin: Partial<LoksePlugin>) {
  return {
    ...pluginDefaults,
    ...plugin,
  };
}
