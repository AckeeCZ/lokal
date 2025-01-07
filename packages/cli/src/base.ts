import { Command } from '@oclif/command';
import updateNotifier from 'update-notifier';

import { getConfig } from '@lokse/core';
import type { LokseConfig } from '@lokse/core';

const pkg = require('../package.json');

export default abstract class Base extends Command {
    protected conf: undefined | null | LokseConfig;

    async init(): Promise<void> {
        const notifier = updateNotifier({
            pkg,
            updateCheckInterval: 1000,
            shouldNotifyInNpmScript: true,
        });
        notifier.notify();

        this.conf = getConfig();
    }
}
