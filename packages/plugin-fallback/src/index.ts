import {
    createPlugin,
    PluginError,
    isEqualCaseInsensitive,
    type GeneralPluginOptions,
    type GeneralPluginMeta,
    type LoksePlugin,
} from '@lokse/core';

export interface PluginOptions extends GeneralPluginOptions {
    defaultLanguage: string;
    logMissingFallback?: boolean;
}

const NOT_FOUND_KEY = 'NOT_FOUND_KEY';

export default function (options: PluginOptions, { languages }: GeneralPluginMeta): LoksePlugin {
    const { defaultLanguage, logger } = options;

    if (!defaultLanguage) {
        throw new PluginError('Default language must be supplied');
    }

    if (!languages.includes(defaultLanguage)) {
        throw new PluginError(
            `Supplied default language ${defaultLanguage} is not available in list of languages ${languages.join(',')}`,
        );
    }

    const logMissingFallback = options.logMissingFallback ?? true;

    const isDefaultLang = (key: string) => isEqualCaseInsensitive(key, defaultLanguage);

    return createPlugin({
        async readTranslation(line, meta) {
            if (line.key && !line.value) {
                const defaultLanguageKey =
                    meta.row._worksheet.headerValues.find(key => isDefaultLang(key)) ?? NOT_FOUND_KEY;

                const fallbackLanguageValue = meta.row.get(defaultLanguageKey) ?? '';

                if (logMissingFallback && !fallbackLanguageValue) {
                    logger.warn(`Fallback translation of key "${meta.key}" not found`);
                }

                line.setValue(fallbackLanguageValue);
            }

            return line;
        },
    });
}
