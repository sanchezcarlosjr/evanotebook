import {BlockAPI} from "@editorjs/editorjs";

export interface EditorJsTool {
  data?: any;
  block?: BlockAPI;
  config?: any;
  readOnly?: boolean;
}
