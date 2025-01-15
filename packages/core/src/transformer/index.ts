import { OutputFormat } from '../constants.js';

import { Transformer } from './transformer.js';
import iOSTransformer from './ios.js';
import androidTransformer from './android.js';
import jsonTransformer from './json.js';

export const transformersByFormat = {
    [OutputFormat.IOS]: iOSTransformer,
    [OutputFormat.ANDROID]: androidTransformer,
    [OutputFormat.JSON]: jsonTransformer,
};

export default Transformer;
