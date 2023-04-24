import {parse} from "@babel/parser";
import * as types from "@babel/types";
import generate from "@babel/generator";

// https://github.com/gzuidhof/starboard-notebook/blob/master/packages/starboard-notebook/src/cellTypes/javascript/eval.ts
export function precompileJS(code: string) {
  try {
    const root = parse(code, {
      attachComment: false,
      sourceType: "module",
      errorRecovery: true,
      ecmaVersion: 8
    } as any);
    const last = root.program.body[root.program.body.length - 1];
    if (last && last.type === "ExpressionStatement") {
      root.program.body.pop();
      // @ts-ignore
      root.program.body.push(types.exportDefaultDeclaration(last.expression));
    }
    if (!last) {
      root.program.body.push(types.exportDefaultDeclaration({
        type: "StringLiteral",
        value: code
      }));
    }
    return generate(root).code;
  } catch (e) {
    return code;
  }
}
