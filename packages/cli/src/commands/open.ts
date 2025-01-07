import { flags } from '@oclif/command';
import open from 'open';

import { NAME, createSheetUrl } from '@lokse/core';
import Base from '../base';
import { id as idFlag } from '../flags';

class Open extends Base {
    static description = 'open localization spreadsheet in default browser';

    static examples = [`$ ${NAME} open -i 1HKjvejcuHIY73WvEkipD7_dmF9dFeNLji3nS2RXcIzk`];

    static flags = {
        help: flags.help({ char: 'h' }),
        id: idFlag.flag(),
    };

    async run(): Promise<void> {
        const { flags } = this.parse(Open);

        const sheetId = flags.id;

        idFlag.invariant(sheetId, 'open');

        await open(createSheetUrl(sheetId));
    }
}

export = Open;
