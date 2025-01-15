import { runCommand as runOclifCommand } from '@oclif/test';
import path from 'path';

export const runCommand = async <T>(cmd: Parameters<typeof runOclifCommand>[0]) => {
    const root = path.resolve(__dirname, '../../..');
    const result = await runOclifCommand<T>(cmd, { root });
    if (result.error) {
        throw result.error;
    }

    return result;
};
