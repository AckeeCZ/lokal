import { Errors } from '@oclif/core';

export const cliInvariant = (expression: unknown, message: string, options: Record<string, any> = {}): void => {
    if (!expression) {
        throw new Errors.CLIError(message, options);
    }
};

export const noExitCliInvariant = (expression: unknown, message: string): void =>
    cliInvariant(expression, message, { exit: false });

export function isCLIError(error: unknown): error is Errors.CLIError {
    return 'message' in (error as Errors.CLIError);
}
