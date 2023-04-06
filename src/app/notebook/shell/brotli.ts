import * as Brotli from "../../../assets/brotli_wasm/brotli_wasm";

export default Brotli.default("/assets/brotli_wasm/brotli_wasm_bg.wasm").then(_ => Brotli);
