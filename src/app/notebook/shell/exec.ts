import { precompileJS } from "./precompile";

export function exec(code: string) {
    const esmCodeUrl = URL.createObjectURL(new Blob([precompileJS(code)], {type: "text/javascript"}));
    return import(/* webpackIgnore: true */ esmCodeUrl)
      .then(x => x.default)
      .finally(() => URL.revokeObjectURL(/* webpackIgnore: true */ esmCodeUrl));
}