import type { GoogleSpreadsheetRow } from 'google-spreadsheet';
import identity from 'lodash/identity.js';

import Line from '../line.js';
import type { Logger } from '../logger.js';
import type Transformer from '../transformer/index.js';

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
    transformLine: (line: Line, meta: TransformLineMeta) => Line | Promise<Line>;
    transformFullOutput: (output: string, meta: TransformFullOutputMeta) => string | Promise<string>;
    readTranslation: (line: Line, meta: ReadTranslationMeta) => Line | Promise<Line>;
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

export type PluginFactory = (options: GeneralPluginOptions, meta: GeneralPluginMeta) => LoksePlugin;

const pluginDefaults: LoksePlugin = {
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
