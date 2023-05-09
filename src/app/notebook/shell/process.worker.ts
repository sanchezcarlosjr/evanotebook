import '../../../polyfills';
import Chart, {ChartComponent, ChartData, ChartDataset, ChartTypeRegistry, DefaultDataPoint} from "chart.js/auto";
import annotationPlugin from 'chartjs-plugin-annotation';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as Immutable from "immutable";
import * as jp from 'jsonpath';
import * as math from 'mathjs';
import * as rx from "rxjs";
import {
  BehaviorSubject,
  catchError,
  concatMap,
  delay,
  delayWhen,
  filter,
  first,
  firstValueFrom,
  from,
  generate,
  interval,
  lastValueFrom,
  map,
  mergeMap,
  mergeScan,
  mergeWith,
  NEVER,
  Observable,
  of,
  pipe,
  range,
  reduce,
  ReplaySubject,
  scan,
  shareReplay,
  startWith,
  Subject,
  Subscriber,
  switchMap,
  switchScan,
  take,
  takeWhile,
  tap,
  throttleTime,
  UnaryFunction
} from "rxjs";
import {fromFetch} from "rxjs/fetch";
import {isMatching, match, P, Pattern} from 'ts-pattern';
import * as protocols from './protocols';
import * as _ from 'lodash';
import { OpenAI } from "langchain/llms/openai";
import {MessagesPlaceholder, PromptTemplate} from "langchain/prompts";
import {ComputeEngine} from "@cortex-js/compute-engine";
import {addRxPlugin, createRxDatabase} from "rxdb";
import {getRxStorageDexie} from "rxdb/plugins/storage-dexie";
import {getCRDTSchemaPart, RxDBcrdtPlugin} from "rxdb/plugins/crdt";
import {enforceOptions} from 'broadcast-channel';
import {RxDBLeaderElectionPlugin} from 'rxdb/plugins/leader-election';
import * as duckdb from '@duckdb/duckdb-wasm';
import ajv from 'ajv';
import {AsyncDuckDB, AsyncDuckDBConnection} from '@duckdb/duckdb-wasm';
import * as arrow from "apache-arrow";
import {RxDatabase} from "rxdb/dist/types/types";
import {OutputData} from "@editorjs/editorjs";
import { JsonSpec } from "langchain/tools";
import { JsonToolkit, createJsonAgent } from "langchain/agents";
import {AgentExecutor, ChatAgent, initializeAgentExecutorWithOptions} from "langchain/agents";
import {
  StructuredOutputParser,
  OutputFixingParser,
  CombiningOutputParser,
  CommaSeparatedListOutputParser,
  RegexParser
} from "langchain/output_parsers";
import { SerpAPI } from "langchain/tools";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
  LengthBasedExampleSelector,
  FewShotPromptTemplate,
  SemanticSimilarityExampleSelector
} from "langchain/prompts";
import { Calculator } from "langchain/tools/calculator";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage, AIChatMessage } from "langchain/schema";
import {BlockAPI} from "@editorjs/editorjs/types/api/block";
import { BufferMemory } from "langchain/memory";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ZapierNLAWrapper } from "langchain/tools";
import {
  ZapierToolKit,
} from "langchain/agents";
import {ConversationChain, LLMChain} from "langchain/chains";
import {BlockToolData, ToolConfig} from "@editorjs/editorjs/types/tools";
import {randomCouchString} from "rxdb/plugins/utils";
import {precompileJS} from "./precompile";
import {DocumentObserver} from "./documentObserver";
import Indexed = Immutable.Seq.Indexed;

addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBcrdtPlugin);


function sendMessage(message: any) {
  self.postMessage(message);
}

class RequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestError";
  }
}

function requestResource(responseEvent: string, request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    globalThis.addEventListener(responseEvent, (event: CustomEvent) => {
      resolve(event.detail.payload);
      // @ts-ignore
      globalThis.removeEventListener(event, null);
    });
    // @ts-ignore
    sendMessage(request);
  });
}

function observeResource(event: string, request: any): Observable<any> {
  return new Observable((subscriber) => {
    // @ts-ignore
    globalThis.addEventListener(event, (event: CustomEvent) => {
      subscriber.next(event.detail.payload);
    });
    self.postMessage(request);
  });
}

// @ts-ignore
globalThis.HTMLCanvasElement = OffscreenCanvas;

function requestCanvas(): Promise<{ canvas: OffscreenCanvas, width: number, height: number }> {
  return requestResource('transferControlToOffscreen', {
    event: 'shell.RequestCanvas', payload: {
      threadId: self.name
    }
  });
}

const speechSynthesis = {
  speak: (text: string) => {
    // @ts-ignore
    sendMessage({event: 'speak', payload: text});
  }
}

async function generateChatGPTRequest(content: string, options: { token: string, messages: { role: string, content: string }[] }) {
  return new Request('https://api.openai.com/v1/chat/completions', {
    'method': 'POST', headers: {
      'Content-Type': 'application/json', 'Authorization': `Bearer ${options.token}`
    }, "body": JSON.stringify({
      "model": "gpt-3.5-turbo", "messages": [{
        "role": "user", "content": content
      }, ...(options?.messages ?? [])]
    })
  });
}

class Terminal {
  clear() {
    sendMessage({
      event: 'terminal.clear', payload: {
        threadId: self.name
      }
    });
  }

  write(text: string) {
    sendMessage({
      event: 'terminal.write', payload: {
        text, threadId: self.name
      }
    });
  }

  rewrite(text: string) {
    sendMessage({
      event: 'terminal.rewrite', payload: {
        text, threadId: self.name
      }
    });
  }
}

class LocalEcho {
  println(text: string) {
    sendMessage({
      event: 'localecho.println', payload: {
        threadId: self.name, text
      }
    });
  }

  printWide(text: string[] | any) {
    sendMessage({
      event: 'localecho.printWide', payload: {
        threadId: self.name, text
      }
    });
  }
}

// @ts-ignore
Map.prototype.toJSON = function toJSON() {
  return [...Map.prototype.entries.call(this)];
}

// @ts-ignore
RegExp.prototype.toJSON = RegExp.prototype.toString;

// @ts-ignore
Set.prototype.toJSON = function toJSON() {
  return [...Set.prototype.values.call(this)];
}

const identity = (x: any) => x;

async function readFile(index: number, fileList: FileList) {
  return {
    index,
    name: fileList.item(index)?.name,
    size: fileList.item(index)?.size,
    type: fileList.item(index)?.type,
    lastModified: fileList.item(index)?.lastModified,
    webkitRelativePath: fileList.item(index)?.webkitRelativePath,
    text: await fileList.item(index)?.text() ?? []
  };
}

interface PromptInputParams {
  placeholder: string;
  type: string;
}

/*
  This is a workaround for the fact that idb and pubkey's Broadcast channel does not work in web workers.
  However, nowadays, the native BroadcastChannel is supported in modern browsers.
 */
enforceOptions({
  type: 'native'
});

async function create_db() {
  const database = await createRxDatabase({
    name: 'eva_notebook', multiInstance: true, storage: getRxStorageDexie()
  });
  await database.addCollections({
    history: {
      schema: {
        title: 'history',
        version: 0,
        type: 'object',
        primaryKey: 'topic',
        properties: {
          topic: {
            type: 'string',
            maxLength: 100
          },
          createdAt: {
            type: 'string',
            maxLength: 100
          },
          title: {
            type: 'string',
            maxLength: 255
          },
          crdts: getCRDTSchemaPart()
        },
        required: ['topic'],
        crdt: {
          field: 'crdts'
        }
      }
    },
    blocks: {
      schema: {
        title: 'blocks', version: 0, primaryKey: 'id', type: 'object', properties: {
          id: {
            type: 'string', maxLength: 100
          }, lastEditedBy: {
            type: 'string',
          }, topic: {
            type: 'string', maxLength: 100, default: "EvaNotebook"
          }, index: {
            type: 'number', minimum: 0, maximum: 1000, multipleOf: 1
          }, createdBy: {
            type: 'string',
          }, type: {
            type: 'string'
          }, data: {
            type: 'object'
          }, tunes: {
            type: 'object'
          }, crdts: getCRDTSchemaPart()
        }, required: ['id', 'type', 'data', 'index', 'lastEditedBy', 'createdBy'], indexes: ['index'], crdt: {
          field: 'crdts'
        }
      }
    }, view: {
      schema: {
        title: 'view', version: 0, primaryKey: 'id', type: 'object', properties: {
          id: {
            type: 'string', maxLength: 100
          }, m: {
            type: 'object'
          }, crdts: getCRDTSchemaPart()
        }, required: ['id'], crdt: {
          field: 'crdts'
        }
      }
    }
  });
  return database;
}

async function dynamicImportDuckDB() {
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  const worker_url = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker!}");`], {type: 'text/javascript'}));
  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  const duckDB = new duckdb.AsyncDuckDB(logger, worker);
  await duckDB.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);
  return {db: duckDB, c: await duckDB.connect()};
}

async function getCanvas2d() {
  return (await requestCanvas()).canvas.getContext('2d');
}

interface StateChart {
  next: any;
  dataset: ChartDataset<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar", DefaultDataPoint<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar">>;
  datasets: ChartDataset<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar", DefaultDataPoint<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar">>[];
  data: ChartData<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar", DefaultDataPoint<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar">, unknown>;
  chart: Chart<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar", DefaultDataPoint<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar">, unknown>;
}

const dynamicImportOpenCV = new Function(`return import("/assets/opencv.js")`);

interface ConfigurationChart {
  type: keyof ChartTypeRegistry;
  data: any;
  options?: any;
  plugins?: ChartComponent[];
  scan?: (stateChart: StateChart) => void;
}

class Table {
  constructor(private port: MessagePort) {
  }

  render(dataSource: object[]) {
    this.port.postMessage({type: 'render', dataSource, displayedColumns: _.keys(dataSource[0])});
  }
}

type MatTreeTransformer = (options: { key: string, level: number, valueIsObject: boolean, value: any, type: string, parentType: string, defaultName: string }) => string;

class MatTree {
  private level = 0;

  constructor(private port: MessagePort, private transform: MatTreeTransformer) {
  }

  render(dataSource: object) {
    this.port.postMessage({type: 'render', dataSource: this.transformJSONToTree(dataSource)});
  }

  transformJSONToTree(json: object, parent?: any): any {
    this.level++;
    const entries = Object.entries(json).map(([key, value]) => {
      key = parent !== "Array" ? key : "";
      let type = value?.constructor?.name;
      value = !!value.toJSON ? value.toJSON() : value;
      if (typeof value === 'object' && !!value) {
        type = `${type}${type === "Array" ? `(${value.length})` : ""}`;
        return {
          name: this.transform({
            key,
            type,
            value,
            valueIsObject: true,
            level: this.level,
            parentType: parent,
            defaultName: `${type} ${key}`.trim()
          }),
          children: this.transformJSONToTree(value, value?.constructor?.name)
        };
      }
      return {
        name: this.transform({
          key,
          type,
          value,
          valueIsObject: false,
          level: this.level,
          parentType: parent,
          defaultName: `${key} ${value}`.trim()
        })
      };
    });
    this.level--;
    return entries;
  }
}

async function buildChart(config: ConfigurationChart) {
  const payload = await requestCanvas() as any;
  Chart.register(config.plugins ?? []);
  const chart = new Chart(payload.canvas, {
    type: config.type, data: config.data, options: config.options
  });
  payload.canvas.width = payload.width;
  payload.canvas.height = payload.height;
  chart.resize();
  return chart;
}

async function buildTable() {
  const payload = await requestResource('table', {
    event: 'table', payload: {
      threadId: self.name
    }
  });
  return new Table(payload);
}

async function buildTree(transformer: MatTreeTransformer) {
  const payload = await requestResource('tree', {
    event: 'tree', payload: {
      threadId: self.name
    }
  });
  return new MatTree(payload, transformer);
}

class Blocks {
  constructor(private environment: { db: Observable<RxDatabase>, currentUrl: URL }) {
  }

  get get$() {
    return this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].find({
      selector: {
        topic: {
          $eq: this.environment.currentUrl.searchParams.get("t") ?? ""
        }
      },
      sort: [{index: 'asc'}]
    }).$));
  }

  getById(id: string): Observable<BlockAPI | null> {
    return this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].findOne(id).$));
  }

  getByIndex(index: number): Observable<BlockAPI | null> {
    return this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].findOne({
      selector: {
        index: {
          $eq: index
        },
        topic: {
          $eq: this.environment.currentUrl.searchParams.get("t") ?? ""
        }
      }
    }).$));
  }

  insert(type?: string, data?: BlockToolData, config?: ToolConfig, index?: number, needToFocus?: boolean, replace?: boolean, id?: string,) {
    return this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].insertCRDT({
      ifMatch: {
        $set: {
          type,
          data,
          config,
          index,
          createdBy: (this.environment.currentUrl.searchParams.get("p") ?? "") + "worker",
          updatedBy: (this.environment.currentUrl.searchParams.get("p") ?? "") + "worker",
          id: id ?? randomCouchString(7),
          topic: this.environment.currentUrl.searchParams.get("t") ?? ""
        }
      }
    })));
  };
}

class EditorJS {
  public static version: "2.26.5";
  public readonly blocks = new Blocks(this.environment);

  constructor(private environment: { db: Observable<RxDatabase>, currentUrl: URL }) {
  }

  get isReady(): Promise<boolean> {
    return new Promise((resolve) => resolve(true));
  }

  save(): Promise<OutputData> {
    return firstValueFrom(this.environment.db.pipe(switchMap((db: RxDatabase) => db["blocks"].find({
      selector: {
        topic: {
          $eq: this.environment.currentUrl.searchParams.get("t") ?? ""
        }
      }
    })
      .exec()), map(blocks => ({
      version: EditorJS.version, blocks
    }))));
  }
}

interface GitHubCommit {
  owner: string;
  repo: string;
  filePath: string;
  commitMessage: string;
  GITHUB_TOKEN: string;
}


class ProcessWorker {
  private environmentObserver: DocumentObserver;

  constructor(private environment: (typeof globalThis) & any, private localEcho: LocalEcho, private terminal: Terminal) {
    environment.window = {};
    environment.db = new Observable((subscriber: Subscriber<any>) => {
      create_db().then(db => {
        subscriber.next(db);
        subscriber.complete();
      }).catch(subscriber.error)
    }).pipe(shareReplay(1));
    this.environmentObserver = new DocumentObserver("environment", environment.db);
    environment.environment = this.environmentObserver.createProxy();
    environment.P = P
    environment.editor = new EditorJS(this.environment);
    environment.from = from
    environment.Pattern = Pattern
    environment.isMatching = isMatching
    environment.match = match
    environment.regex = (expr: RegExp) => P.when((str: string): str is never => expr.test(str));
    environment.Immutable = Immutable;
    environment.clear = tap(() => this.terminal.clear());
    environment.help = from(['clear - clears the output', `connect(protocol, options) - connects to some node using a protocol and its options.`, 'echo(message) - displays the message on the terminal', 'fromFetch(input) - fetch some web api resource', 'Learn more on https://carlos-eduardo-sanchez-torres.sanchezcarlosjr.com/Assisting-dementia-patients-with-the-Embodied-Voice-Assistant-Eva-Simulator-at-CICESE-9aade1ebef9948acafba73d834b19d0b#0a45eb21f25a4551ba920e35165dce1e'])
      .pipe(tap(message => this.localEcho.println(message)));
    environment.tap = tap;
    environment.map = map;
    environment.reduce = reduce;
    environment.OpenAI = OpenAI;
    environment.PromptTemplate = PromptTemplate;
    environment.LLMChain = LLMChain;
    environment.ChatOpenAI = ChatOpenAI;
    environment.SystemChatMessage = SystemChatMessage;
    environment.AIChatMessage = AIChatMessage;
    environment.HumanChatMessage = HumanChatMessage;
    environment.SerpAPI = SerpAPI;
    environment.ConversationChain = ConversationChain;
    environment.BufferMemory = BufferMemory;
    environment.ZapierNLAWrapper = ZapierNLAWrapper;
    environment.ZapierToolKit = ZapierToolKit;
    environment.JsonSpec = JsonSpec;
    environment.JsonToolkit = JsonToolkit;
    environment.createJsonAgent = createJsonAgent;
    environment.OutputFixingParser = OutputFixingParser;
    environment.StructuredOutputParser = StructuredOutputParser;
    environment.CommaSeparatedListOutputParser = CommaSeparatedListOutputParser;
    environment.CombiningOutputParser = CombiningOutputParser;
    environment.RegexParser = RegexParser;
    environment.Calculator = Calculator;
    environment.LengthBasedExampleSelector = LengthBasedExampleSelector;
    environment.LengthBasedExampleSelector = FewShotPromptTemplate;
    environment.initializeAgentExecutorWithOptions = initializeAgentExecutorWithOptions;
    environment.SystemMessagePromptTemplate = SystemMessagePromptTemplate;
    environment.HumanMessagePromptTemplate = HumanMessagePromptTemplate;
    environment.ChatPromptTemplate = ChatPromptTemplate;
    environment.MemoryVectorStore = MemoryVectorStore;
    environment.OpenAIEmbeddings = OpenAIEmbeddings;
    environment.SemanticSimilarityExampleSelector = SemanticSimilarityExampleSelector;
    environment.AgentExecutor = AgentExecutor;
    environment.ChatAgent = ChatAgent;
    environment.MessagesPlaceholder = MessagesPlaceholder;
    environment.ajv = ajv;
    environment.math = math;
    environment.generate = generate;
    environment.mergeMap = mergeMap;
    environment.concatMap = concatMap;
    environment.scan = scan;
    environment.filter = filter;
    environment.range = range;
    environment.ImagesAccepted = ".jpg, .png, .jpeg, .svg, .gif, .bmp, .tif, .tiff|image/*";
    environment.delayWhen = delayWhen;
    environment.serialize = (obj: any, spaces?: number) => {
      try {
        return JSON.stringify(obj, (key: string, value: any) => {
          return match(value)
            .with(P.instanceOf(FileList), (fileList: FileList) => ({
              fileList: Immutable.Range(0, fileList.length).reduce((acc, index) => acc.push({
                index,
                name: fileList.item(index)?.name,
                size: fileList.item(index)?.size,
                type: fileList.item(index)?.type,
                lastModified: fileList.item(index)?.lastModified,
                webkitRelativePath: fileList.item(index)?.webkitRelativePath
              }), Immutable.List<any>([]))
            })).with(P.instanceOf(Function), (func: Function) => func.toString())
            .otherwise(x => x);
        }, spaces);
      } catch (e) {
        return obj.toString();
      }
    };
    environment.deserialize = (text: string) => {
      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
    };
    environment.lastValueFrom = lastValueFrom;
    environment.firstValueFrom = firstValueFrom;
    environment.from = from;
    environment.of = of;
    environment.interval = interval;
    environment.startWith = startWith;
    environment.first = first;
    environment.switchScan = switchScan;
    environment.mergeScan = mergeScan;
    environment.delay = delay;
    environment.speak = tap((text: string) => speechSynthesis.speak(text));
    environment.take = take;
    environment.switchMap = switchMap;
    environment.Rx = rx;
    environment.doAside = (...operations: UnaryFunction<any, any>[]) => // @ts-ignore
      tap((value: any) => of(value).pipe(...operations).subscribe());
    // Consult https://www.twilio.com/docs/sms/api#send-messages-with-the-sms-api
    environment.sendSMS = (options: { from?: string, to?: string, account_sid: string, auth_token: string }) => switchMap((body: any) => fromFetch(`https://api.twilio.com/2010-04-01/Accounts/${options.account_sid}/Messages.json`, {
      method: 'POST', headers: {
        'Authorization': 'Basic ' + btoa(`${options.account_sid}:${options.auth_token}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      }, body: new URLSearchParams({
        'From': body?.From ?? options.from, 'Body': body?.Body ?? body, 'To': body?.To ?? options.to
      })
    }).pipe(catchError(err => of({error: true, message: err.message})), map(_ => body)));
    environment.ce = new ComputeEngine();
    environment.sendEmail = (options: { type?: string, provider?: string, personalizations?: any, token: string, proxy?: string, to: string | string[], from: string, subject: string }) => switchMap(state => fromFetch(options?.proxy ? `${options.proxy}https%3A%2F%2Fapi.sendgrid.com%2Fv3%2Fmail%2Fsend` : "https://api.sendgrid.com/v3/mail/send", {
      method: 'POST', headers: {
        "Content-Type": "application/json", Authorization: `Bearer ${options.token}`
      }, body: JSON.stringify({
        "personalizations": options.personalizations ?? [{
          "to": Array.isArray(options?.to) ? options.to.map(email => ({email})) : [{
            email: options?.to ?? ""
          }]
        }], "from": {
          email: options?.from ?? ""
        }, subject: options?.subject ?? "[EvaNotebook] Data from your notebook", "content": [{
          "type": options.type ?? "text/plain", "value": state
        }]
      })
    }).pipe(map(_ => state)));
    environment.meanAnnotation = (datasetIndex = 0, borderColor = 'black') => ({
      type: 'line', borderColor, borderDash: [6, 6], borderDashOffset: 0, borderWidth: 3, label: {
        display: true,
        content: (ctx: any) => 'Mean: ' + math.mean(ctx.chart.data.datasets[datasetIndex].data).toFixed(2),
        position: 'end'
      }, scaleID: 'y', value: (ctx: any) => math.mean(ctx.chart.data.datasets[datasetIndex].data)
    });
    environment.simpleDataLabels = () => ({
      backgroundColor: function (context: any) {
        return context.dataset.backgroundColor
      }, borderRadius: 4, color: 'white', font: {
        weight: 'bold'
      }, formatter: Math.round, padding: 6
    });
    environment.minAnnotation = (datasetIndex = 0, borderColor = 'black') => ({
      type: 'line', borderColor, borderWidth: 3, label: {
        display: true,
        backgroundColor: 'black',
        borderColor: 'black',
        borderRadius: 10,
        borderWidth: 2,
        content: (ctx: any) => 'Lower bound: ' + math.min(ctx.chart.data.datasets[datasetIndex].data).toFixed(2),
        rotation: 'auto'
      }, scaleID: 'y', value: (ctx: any) => math.min(ctx.chart.data.datasets[datasetIndex].data).toFixed(2)
    });
    environment.maxAnnotation = (datasetIndex = 0, borderColor = 'black') => ({
      type: 'line', borderColor, borderWidth: 3, label: {
        display: true,
        backgroundColor: 'black',
        borderColor: 'black',
        borderRadius: 10,
        borderWidth: 2,
        content: (ctx: any) => 'Upper bound: ' + math.max(ctx.chart.data.datasets[datasetIndex].data).toFixed(2),
        rotation: 'auto'
      }, scaleID: 'y', value: (ctx: any) => math.max(ctx.chart.data.datasets[datasetIndex].data).toFixed(2)
    });
    environment.meanPlusStandardDeviationAnnotation = (datasetIndex = 0, borderColor = 'black') => ({
      type: 'line',
      borderColor: 'rgba(102, 102, 102, 0.5)',
      borderDash: [6, 6],
      borderDashOffset: 0,
      borderWidth: 3,
      label: {
        display: true,
        backgroundColor: 'rgba(102, 102, 102, 0.5)',
        color: 'black',
        content: (ctx: any) => "x̄+σ:" + (math.mean(ctx.chart.data.datasets[datasetIndex].data) + math.std(ctx.chart.data.datasets[datasetIndex].data)).toFixed(2),
        position: 'start'
      },
      scaleID: 'y',
      value: (ctx: any) => math.mean(ctx.chart.data.datasets[datasetIndex].data) + math.std(ctx.chart.data.datasets[datasetIndex].data)
    });
    environment.meanMinusStandardDeviationAnnotation = (datasetIndex = 0, borderColor = 'black') => ({
      type: 'line',
      borderColor: 'rgba(102, 102, 102, 0.5)',
      borderDash: [6, 6],
      borderDashOffset: 0,
      borderWidth: 3,
      label: {
        display: true,
        backgroundColor: 'rgba(102, 102, 102, 0.5)',
        color: 'black',
        content: (ctx: any) => "x̄-σ:" + (math.mean(ctx.chart.data.datasets[datasetIndex].data) - math.std(ctx.chart.data.datasets[datasetIndex].data)).toFixed(2),
        position: 'start'
      },
      scaleID: 'y',
      value: (ctx: any) => math.mean(ctx.chart.data.datasets[datasetIndex].data) - math.std(ctx.chart.data.datasets[datasetIndex].data)
    });
    environment.shareReplay = shareReplay;
    environment.Subject = Subject;
    environment.BehaviorSubject = BehaviorSubject;
    environment.ReplaySubject = ReplaySubject;
    environment.throwError = (error: Error) => {
      throw error;
    }
    environment.print = (...params: string[]) => {
      params.forEach(param => {
        this.terminal.write(param);
      });
      return params;
    }
    environment.importOpenCV = new Observable(observer => {
      if (environment.cv) {
        observer.next(environment.cv);
        observer.complete();
        return;
      }
      environment.Module = {
        onRuntimeInitialized() {
          observer.next(environment.cv);
          observer.complete();
        }
      };
      // Angular Compiler doesn't support dynamic import in the worker.
      // Some browsers support dynamic import in the worker, but not all.
      dynamicImportOpenCV().then((opencv: any) => {
        environment.cv = opencv.default;
      });
    }).pipe(shareReplay(1));
    environment.base64ToBlob = (contentType = 'image/jpeg') => map((obj: any) => {
      const byteCharacters = atob(obj.message);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      obj.message = new Blob([byteArray], {type: contentType});
      return obj;
    });
    environment.blobToImage = switchMap((obj: { message: Blob }) => {
      return from(createImageBitmap(obj.message)).pipe(map((imageBitmap: ImageBitmap) => {
        // @ts-ignore
        obj.message = imageBitmap;
        return obj;
      }));
    });
    environment.imshow = () => pipe(switchScan(async (promise: { message: Promise<OffscreenRenderingContext | null> }, obj: { message: ImageBitmap }) => {
      const context = await promise.message;
      if (!context) {
        return Promise.reject('No context available');
      }
      // @ts-ignore
      context.canvas.width = obj.message.width;
      // @ts-ignore
      context.canvas.height = obj.message.height;
      // @ts-ignore
      context.drawImage(obj.message, 0, 0);
      // @ts-ignore
      obj.message = context;
      return obj;
    }, {message: getCanvas2d()}));
    environment.captureStream = (options ?: any /* MediaStreamConstraints | undefined) */) => observeResource('transferStreamToOffscreen', {
      event: 'shell.RequestCaptureStream', payload: {
        threadId: self.name,
        options
      }
    });
    environment.focusOnImage = () =>
      pipe(
        filter(({message}) => message as unknown as boolean),
        environment.base64ToBlob(),
        environment.blobToImage,
        environment.imshow()
      );
    environment.annotationPlugin = annotationPlugin;
    environment.ChartDataLabels = ChartDataLabels;
    environment.basicStatisticsAnnotations = (datasetIndex = 0, borderColor = 'black') => ({
      meanAnnotation: environment.meanAnnotation(datasetIndex, borderColor),
      minAnnotation: environment.minAnnotation(datasetIndex, borderColor),
      maxAnnotation: environment.maxAnnotation(datasetIndex, borderColor),
      meanMinusStandardDeviationAnnotation: environment.meanMinusStandardDeviationAnnotation(datasetIndex, borderColor),
      meanPlusStandardDeviationAnnotation: environment.meanPlusStandardDeviationAnnotation(datasetIndex, borderColor),
    });
    environment.openSnackbar = tap(({
                                      message,
                                      action
                                    }: { message: string, action: string }) => postMessage({
      'event': 'openSnackBar',
      'payload': {message, action}
    }));
    environment.println = (observerOrNext: any) => this.localEcho.println(environment.serialize(observerOrNext, 1)?.replace(/\\u002F/g, "/"));
    environment.display = tap(environment.println);
    environment.log = tap(observer => console.log(observer));
    environment.input = (options: PromptInputParams) => observeResource('prompt', {
      event: 'prompt', payload: {
        threadId: self.name, options
      }
    });
    environment.windowEvent = (event: any, options: any) => observeResource(event, {
      event: options.event, payload: {
        threadId: self.name, options
      }
    });
    environment.prompt = (options: PromptInputParams) => switchMap(_ => environment.input(options));
    // TODO: Add support for compress and decompress
    environment.compress = (options: { quality: number }) => switchMap((input: string) => observeResource('compress', {
      event: 'compress', payload: {
        threadId: self.name, input, options
      }
    }).pipe(first()));
    environment.decompress = switchMap((input: string) => observeResource('decompress', {
      event: 'decompress', payload: {
        threadId: self.name, input,
      }
    }).pipe(first()));
    environment.pipe = pipe;
    environment._ = _;
    environment.NEVER = NEVER;
    environment.throttleTime = throttleTime;
    environment.forever = switchMap(() => NEVER);
    environment.chat = (observable: Observable<any> | Function) => pipe(filter((configuration: any) => configuration.ready), switchMap((configuration: any) => (typeof observable === "function" ? observable(configuration.message) : observable).pipe(tap(next => configuration.connection.send(next)))));
    environment.sendOverProtocol = tap((configuration: any) => configuration.connection.send(configuration.message));
    environment.randint = (min = 0, max = 10) => Math.floor(Math.random() * (max - min)) + min;
    environment.fromFetch = (input: string | Request, init?: RequestInit | undefined) => fromFetch(input, init).pipe(switchMap((response) => match(response).with(P.when(r => r.ok && /JSON/gi.test(r.headers.get("Content-Type") ?? "")), (r) => from(r.json())).with(P.when(r => r.ok && /octet-stream|image/gi.test(r.headers.get("Content-Type") ?? "")), (r) => from(r.blob())).with(P.when(r => r.ok && /form-data/gi.test(r.headers.get("Content-Type") ?? "")), (r) => from(r.formData())).with(P.when(r => r.ok), (r) => from(r.text())).otherwise(() => of({
      error: true, message: `The HTTP status is ${response.status}. ${response.text}`
    }))), catchError(err => of({error: true, message: err.message})));
    environment.commitOnGitHub = (options: GitHubCommit) => concatMap((content: any) => {
      return from(fetch(`https://api.github.com/repos/${options.owner}/${options.repo}/contents/${options.filePath}`, {
        headers: {
          Authorization: `token ${options.GITHUB_TOKEN}`, Accept: "application/vnd.github+json",
        }
      }))
        .pipe(switchMap(async (response) => {
          if (response.ok) {
            const data = await response.json();
            return {sha: data.sha};
          } else if (response.status === 404) {
            return {sha: null};
          }
          throw new Error("Error while fetching the file");
        }), switchMap(({sha}) => fromFetch(`https://api.github.com/repos/${options.owner}/${options.repo}/contents/${options.filePath}`, {
          headers: {
            Authorization: `token ${options.GITHUB_TOKEN}`, Accept: "application/vnd.github+json",
          }, method: "PUT", body: JSON.stringify({
            message: options.commitMessage, content, sha
          }),
        })))
    });
    environment.readFiles = pipe(map((fileList: FileList) => Immutable.Range(0, fileList.length).map((index) => from(readFile(index, fileList)) as Observable<any>)), switchMap((v: Indexed<Observable<any>>): any => v.get(0)?.pipe(mergeWith(v.slice(1, v.size).toArray()))));
    environment.importFiles = (options: any) => observeResource('shell.InputFile', {
      event: 'file', payload: {
        threadId: self.name, ...options
      }
    });
    environment.jsonToTable = () => pipe(switchScan(async (acc, data: any[]) => {
      const table = await acc;
      table.render(data);
      return acc;
    }, buildTable()));
    environment.jsonToTree = (transformer: MatTreeTransformer = ({defaultName}) => defaultName) => pipe(switchScan(async (acc, data: any[]) => {
      const table = await acc;
      table.render(data);
      return acc;
    }, buildTree(transformer)));
    // Consult https://jsonforms.io/ to learn more about options.
    environment.form = (options: { uischema: object, schema: object, data: any }) => observeResource('form', {
      event: 'form', payload: {
        threadId: self.name
      }
    }).pipe(first(), switchMap((port: MessagePort) => new Observable((observer) => {
      let ready = false;
      port.onmessage = (event: MessageEvent) => {
        ready = true;
        if (event.data.type === "ready") {
          port.postMessage({type: "setOptions", options});
        }
        if (event.data.type === "data") {
          observer.next(event.data.data);
        }
      };
      interval(200).pipe(startWith(0), takeWhile(_ => !ready)).subscribe(_ => port.postMessage({type: "ready"}));
    })));
    environment.plot = (config: ConfigurationChart) => pipe(switchScan(async (acc, next) => {
      const chart = await acc;
      config.scan?.({dataset: chart.data.datasets[0], next, datasets: chart.data.datasets, data: chart.data, chart});
      chart.update();
      return acc;
    }, buildChart(config)), environment.forever);
    environment.chart = (config: ConfigurationChart) => of(undefined).pipe(environment.plot(config));
    environment.delayEach = (milliseconds: number) => delayWhen((_, i) => interval(i * milliseconds));
    environment.arrowTableToJSON = map((table: arrow.Table<any>) => table.toArray().map((row) => row.toJSON()));
    environment.insertCSVToDuckDB = (observable: Observable<string>, path: string = 'rows.csv') => concatMap((obj: { db: AsyncDuckDB, c: AsyncDuckDBConnection }) => observable.pipe(switchMap(async (csv: string) => {
      await obj.db.registerFileText(path, csv);
      return obj;
    })));
    environment.insertJSONToDuckDB = (observable: Observable<object>, path: string = 'rows.json', name: string = 'rows') => concatMap((obj: { db: AsyncDuckDB, c: AsyncDuckDBConnection }) => observable.pipe(switchMap(async (json) => {
      await obj.db.registerFileText(path, JSON.stringify(json));
      await obj.c.insertJSONFromPath(path, {name});
      return obj;
    })));
    environment.duckDBStatement = (query: string) => concatMap(async (obj: { c: AsyncDuckDBConnection }) => {
      await obj.c.query(query);
      return obj;
    });
    environment.duckDBQuery = (query: string) => concatMap((obj: { c: AsyncDuckDBConnection }) => obj.c.query(query));
    environment.duckDBPrepare = (query: string, params: any[]) => concatMap(async (obj: { c: AsyncDuckDBConnection }) => {
      const statement = await obj.c.prepare(query);
      return statement.query(params);
    });
    environment.importDuckDB = new Observable((observer) => {
      dynamicImportDuckDB().then((duckdb) => {
        observer.next(duckdb);
        observer.complete();
        // TODO: Add support for duckdb.close().
      });
    }).pipe(shareReplay(1));
    environment.importJSON = (options: any) => environment.importFiles({
      ...options, accept: "application/json"
    }).pipe(environment.readFiles, map((file: { text: string }) => environment.deserialize(file.text)));
    environment.filterErrors = pipe(map((x: { message: string }) => x.message), environment.display, filter((x: { error: boolean }) => x.error));
    environment.jp = jp;
    environment.jpquery = (path: string) => map((ob: object) => jp.query(ob, path));
    environment.jpapply = (path: string, fn: (x: any) => any) => map((ob: object) => jp.apply(ob, path, fn));
    environment.write = (f = identity) => tap((observerOrNext: string) => this.terminal?.write(f(observerOrNext)));
    environment.rewrite = (f = identity) => tap((observerOrNext: string) => this.terminal?.rewrite(f(observerOrNext)));
    environment.render = (x: string) => of(x).pipe(map(x => x.replace(/\n|\r|\r\n/gm, "")), environment.write());
    environment.printWide = tap(observerOrNext => this.localEcho.printWide(Array.isArray(observerOrNext) ? observerOrNext : environment.throwError(new Error(`TypeError: The operator printWide only supports iterators. ${observerOrNext} has to be an iterator.`))));
    environment.echo = (msg: any) => of(msg).pipe(filter(x => !!x), environment.display);
    environment.publishMQTT = (topic: string, payloadName: string = "text", options = {
      publication: {},
      message: {}
    }) => map((payload: string) => ({
      topic, message: environment.serialize({[`${payloadName}`]: payload, ...options.message}), ...options.publication
    }));
    environment.sayHermes = environment.publishMQTT("hermes/tts/say");
    environment.gpt = (options: any) => switchMap((message: string) => from(generateChatGPTRequest(message, options)).pipe(switchMap(request => environment.fromFetch(request)
      .pipe(filter((x: any) => !x.error), map((response: any) => response.choices[0].message.content)))));
    // @ts-ignore
    environment.connect = (protocol: string, options: any) => protocols[protocol] ? // @ts-ignore
      (new protocols[protocol]()).connect(options) : of({error: true, message: `Error: ${protocol} is not available.`})
  }

  println(next: any) {
    match(next)
      .with(P.string, (next: string) => this.terminal.write(next)).otherwise(next => this.environment.println(next))
  }

  async exec(code: string) {
    try {
      const esmCodeUrl = URL.createObjectURL(new Blob([precompileJS(code)], {type: "text/javascript"}));
      return await (new Function(`return import("${esmCodeUrl}").then(x => x.default)`))();
    } catch (error) {
      if ((error as Error)?.message.includes("import")) {
        return eval(code);
      }
      throw error;
    }
  }

  init(payload: { href: string }) {
    this.environment.window.location = {
      href: payload.href
    };
    this.environment.currentUrl = new URL(payload.href);
    return this.environmentObserver.init();
  }
}

const processWorker = new ProcessWorker(globalThis, new LocalEcho(), new Terminal());

// @ts-ignore
globalThis.addEventListener('exec', async (event: CustomEvent) => {
  if (!event.detail.payload?.code) {
    sendMessage({'event': 'shell.Stop', payload: {threadId: self.name}});
    return;
  }
  try {
    await processWorker.init(event.detail.payload);
    const response = await processWorker.exec(event.detail.payload.code);
    if (!(response instanceof Observable)) {
      processWorker.println(response);
      sendMessage({'event': 'shell.Stop', payload: {threadId: self.name}});
      return;
    }
    response.subscribe({
      // @ts-ignore
      complete: () => sendMessage({'event': 'shell.Stop', payload:   {threadId: self.name}})
    });
  } catch (e) {
    // @ts-ignore
    sendMessage({
      'event': 'shell.error', // @ts-ignore
      payload: {threadId: self.name, text: `<pre class="py-error wrap">${e?.name}: ${e?.message}</pre>`}
    });
  }
});

self.onmessage = (event) => globalThis.dispatchEvent(new CustomEvent(event.data.event, {
  bubbles: true, detail: {
    payload: event.data.payload
  }
}));
