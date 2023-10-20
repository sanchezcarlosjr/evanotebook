import {Language} from "./language";
import {Extension} from "@codemirror/state";
import {sql} from "@codemirror/lang-sql";
import { Observable, firstValueFrom, shareReplay } from "rxjs";
// @ts-ignore
import { gluesql } from 'gluesql';
import { autocompletion, startCompletion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";

interface Gluesql {
  loadIndexedDB: () => void;
  query: (x: string) => Promise<string>;
}
/*
  TODO: Connect GlueSQL to RXDB, Dexie. However, they manage its version control.
*/
const gluesqlInstance$ = new Observable<Gluesql>(subscriber => {
  gluesql("/assets/gluesql/gluesql_js_bg.wasm").then(async (db: Gluesql) => {
    db.loadIndexedDB();
    return db;
  }).then((db: Gluesql) => {
    subscriber.next(db);
    subscriber.complete();
  });
}).pipe(shareReplay(1));

// @ts-ignore
globalThis.gluesqlConnection = () => firstValueFrom(gluesqlInstance$);
function sqlAutocompleter(context: CompletionContext): CompletionResult | null {
  let word = context.matchBefore(/\w*/)
  if (!word || word.from == word.to && !context.explicit)
    return null
  return {
    from: word.from,
    options: [
      {label: "CREATE", type: "create", apply: `CREATE TABLE table (
    PersonID int,
    LastName TEXT
);`, detail: "create table"},
      {label: "SELECT", type: "select", apply: "select * from table;", detail: "select table"},
      {label: "INSERT", type: "insert", apply: `INSERT INTO table (column1, column2, column3) VALUES (value1, value2, value3);`, detail: "The INSERT INTO statement is used to insert new records in a table."}
    ]
  }
}

export class Sql extends Language {
  get name() {
    return 'sql';
  }

  override dispatchShellRun() {
    super.dispatchShellRun();
    gluesqlInstance$.subscribe(instance => {
      instance.query(this.mostRecentCode).then((output: any) => {
        if (output[output.length-1].rows) {
          // @ts-ignore
          globalThis.createTable(this.cell, {
            type: 'render',
            displayedColumns: Object.keys(output[output.length-1].rows[0]),
            dataSource: output[output.length-1].rows
          });
        } else {
          this.write(JSON.stringify(output[output.length-1]));
        }
        this.stop();
      }).catch((e: any) => {
        this.rewrite(`<pre class="py-error wrap">${e}</pre>`);
        this.stop();
      });
    });
    return true;
  }

  override getExtensions(): Extension[] {
    return [sql(), autocompletion({ override: [sqlAutocompleter] })];
  }
}
