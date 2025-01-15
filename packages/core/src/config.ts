import { cosmiconfig } from 'cosmiconfig';

import { OutputFormat, NAME } from './constants.js';
import type { PluginDefinition, PluginName } from './plugins/index.js';
import type { SheetsFilter } from './reader/index.js';

const explorer = cosmiconfig(NAME, {
    searchPlaces: [
        'package.json',
        `.${NAME}rc`,
        `.${NAME}rc.json`,
        `.${NAME}rc.yaml`,
        `.${NAME}rc.yml`,
        `.${NAME}rc.ts`,
        `.${NAME}rc.js`,
        `.${NAME}rc.cjs`,
        `${NAME}.config.ts`,
        `${NAME}.config.js`,
        `${NAME}.config.cjs`,
    ],
});

export type LokseConfig = {
    sheetId?: string;
    dir?: string;
    languages?: string[];
    column?: string;
    format?: OutputFormat;
    sheets?: SheetsFilter;
    splitTranslations?: boolean | string[];
    plugins?: (PluginName | PluginDefinition)[];
};

export async function getConfig(
    searchFrom: string | undefined = process.env.LOKSE_CONFIG_PATH,
): Promise<undefined | null | LokseConfig> {
    const result = await explorer.search(searchFrom);
    return result?.config;
}
