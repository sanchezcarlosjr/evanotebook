import {BlockAPI} from "@editorjs/editorjs";

export interface Block {
  data?: any;
  block?: BlockAPI;
  config?: any;
  readOnly?: boolean;
}
