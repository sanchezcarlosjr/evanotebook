import {Buffer} from 'buffer';

// @ts-ignore
globalThis.global = globalThis;
// @ts-ignore
globalThis.process = {
  env: {
    BABEL_TYPES_8_BREAKING: ''
  }
}

//  @ts-ignore
globalThis.Buffer = Buffer;
