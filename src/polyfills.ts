// @ts-ignore
globalThis.global = globalThis;
// @ts-ignore
globalThis.process = {
  env: {
    BABEL_TYPES_8_BREAKING: ''
  }
}

//  @ts-ignore
globalThis.Buffer = {
  //  @ts-ignore
  isBuffer: (obj: any) => false
}
