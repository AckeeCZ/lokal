import { mapKeys, mapValues } from 'lodash';

import { CustomPatterns } from './index.js';

export const lowerCaseKeys = (patterns: CustomPatterns): Record<string, string> =>
    mapKeys(patterns, (_, key) => key.toLowerCase());

const convertStringToRegex = (string: string) => new RegExp(`(\\s|^)${string}(\\s+)`, 'gim');

export const regexifyValues = (patterns: CustomPatterns): Record<string, RegExp> =>
    mapValues(patterns, value => convertStringToRegex(value));
