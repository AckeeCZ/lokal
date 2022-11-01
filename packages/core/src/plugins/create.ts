import type { GoogleSpreadsheetRow } from "google-spreadsheet";
import { identity } from "lodash";

import Line from "../line";
import type { Logger } from "../logger";
import type { WorksheetLinesByTitle } from "../reader";
import type { LinesWithNamespace } from "../sorter";
import type Transformer from "../transformer";

export interface SortLinesMeta {
  language: string;
  linesWithNamespace: LinesWithNamespace[];
}

export interface TransformLineMeta {
  language: string;
  domain?: string;
}

export interface TransformFullOutputMeta {
  transformer: Transformer;
  language: string;
  domain?: string;
}

export interface ReadTranslationMeta {
  key: string;
  language: string;
  row: GoogleSpreadsheetRow;
}

export interface LoksePlugin {
  sortLines: (
    linesByWorkshet: WorksheetLinesByTitle,
    meta: SortLinesMeta
  ) => void;
  transformLine: (line: Line, meta: TransformLineMeta) => Line | Promise<Line>;
  transformFullOutput: (
    output: string,
    meta: TransformFullOutputMeta
  ) => string | Promise<string>;
  readTranslation: (
    line: Line,
    meta: ReadTranslationMeta
  ) => Line | Promise<Line>;
}

export interface NamedLoksePlugin extends LoksePlugin {
  pluginName: string;
}

export interface GeneralPluginOptions {
  logger: Logger;
}

export interface GeneralPluginMeta {
  languages: string[];
}

export type PluginFactory = (
  options: GeneralPluginOptions,
  meta: GeneralPluginMeta
) => LoksePlugin;

const pluginDefaults: LoksePlugin = {
  sortLines: identity,
  transformLine: identity,
  transformFullOutput: identity,
  readTranslation: identity,
};

export function createPlugin(plugin: Partial<LoksePlugin>): LoksePlugin {
  return {
    ...pluginDefaults,
    ...plugin,
  };
}
