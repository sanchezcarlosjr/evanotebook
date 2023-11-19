import { exec } from "../../shell/exec";
import { JavaScript } from "./JavaScript";
import '../../shell/protocols';
import {stringify} from "../stringToHTML";

export class JavaScriptMainThread extends JavaScript {
    override dispatchShellRun() {
        this.reset();
        exec(this.mostRecentCode)
          .then(result => this.rewrite(result))
          .catch((error:any) => this.rewrite(`<pre class="py-error wrap">${error?.name}: ${error?.message}</pre>`))
          .finally(() => this.dispatchShellStop());
        return true;
    }
    override get name() {
        return 'javascript main thread';
    }
}
