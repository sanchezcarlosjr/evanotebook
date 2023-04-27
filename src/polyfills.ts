import {Buffer} from 'buffer';

// @ts-ignore
globalThis.global = globalThis;

// @ts-ignore
globalThis.module = {
  exports: {}
};

// @ts-ignore
globalThis.require = (path: string) => {
  if (path.startsWith('crypto')) {
    return globalThis.crypto;
  }
};

// @ts-ignore
globalThis.process = {
  env: {
    BABEL_TYPES_8_BREAKING: ''
  }
}

//  @ts-ignore
globalThis.Buffer = Buffer;
