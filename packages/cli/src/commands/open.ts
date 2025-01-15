import { Flags } from '@oclif/core';
import open from 'open';

import { NAME, createSheetUrl } from '@lokse/core';
import Base from '../base.js';
import { id as idFlag } from '../flags/index.js';

export default class Open extends Base {
    static description = 'open localization spreadsheet in default browser';

    static examples = [`$ ${NAME} open -i 1HKjvejcuHIY73WvEkipD7_dmF9dFeNLji3nS2RXcIzk`];

    static flags = {
        help: Flags.help({ char: 'h' }),
        id: idFlag.flag,
    };

    async run(): Promise<void> {
        console.debug(open);
        const { flags } = await this.parse(Open);

        const sheetId = flags.id;

        idFlag.invariant(sheetId, 'open');

        await open(createSheetUrl(sheetId));
    }
}
