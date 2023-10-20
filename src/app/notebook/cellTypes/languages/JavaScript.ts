import {Language} from "./language";
import {esLint, javascript} from "@codemirror/lang-javascript"
import {linter, lintGutter} from "@codemirror/lint";
// @ts-ignore
import * as eslint from "eslint-linter-browserify";

// eslint configuration
const config = {
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  env: {
    browser: true,
    node: false,
  },
  rules: {
    semi: ["warning", "always"]
  },
};

export class JavaScript extends Language {
  override dispatchShellRun() {
    super.dispatchShellRun();
    window.dispatchEvent(new CustomEvent('shell.Run', {
      bubbles: true, detail: {
        payload: {
          code: this.mostRecentCode,
          threadId: this.editorJsTool?.block?.id
        }
      }
    }));
    return true;
  }

  get name() {
    return 'javascript';
  }

  override getExtensions(): any[] {
    return [
      javascript(),
      lintGutter(),
      // @ts-ignore
      linter(esLint(new eslint.Linter(), config))
    ]
  }

}
