import Chart, { ChartComponent, ChartData, ChartDataset, ChartTypeRegistry, DefaultDataPoint } from "chart.js/auto";
import annotationPlugin from 'chartjs-plugin-annotation';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as Immutable from "immutable";
import * as jp from 'jsonpath';
import * as math from 'mathjs';
import * as rx from "rxjs";
import {
  catchError,
  delay,
  delayWhen,
  filter,
  first,
  from,
  generate,
  interval,
  lastValueFrom,
  map,
  mergeScan,
  mergeWith,
  NEVER,
  Observable,
  of,
  pipe,
  range,
  reduce,
  scan,
  startWith,
  switchMap,
  switchScan,
  take, takeUntil, takeWhile,
  tap,
  throttleTime,
  UnaryFunction
} from "rxjs";
import { fromFetch } from "rxjs/fetch";
import { isMatching, match, P, Pattern } from 'ts-pattern';
import * as protocols from './protocols';
import Indexed = Immutable.Seq.Indexed;

import { ComputeEngine } from "@cortex-js/compute-engine";

function sendMessage(message: any) {
  self.postMessage(message);
}

class RequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestError";
  }
}

function requestResource(event: string, request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    globalThis.addEventListener(event, (event: CustomEvent) => {
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

function requestPlot(options: object): Promise<string | null> {
  return requestResource('transferControlToOffscreen', {
    event: 'plot', payload: {
      threadId: self.name,
      ...options
    }
  });
}

const speechSynthesis = {
  speak: (text: string) => {
    // @ts-ignore
    sendMessage({ event: 'speak', payload: text });
  }
}

async function generateChatGPTRequest(content: string, options: { token: string, messages: { role: string, content: string }[] }) {
  return new Request('https://api.openai.com/v1/chat/completions',
    {
      'method': 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.token}`
      }, "body": JSON.stringify({
        "model": "gpt-3.5-turbo",
        "messages": [
          {
            "role": "user",
            "content": content
          },
          ...(options?.messages ?? [])
        ]
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
        text,
        threadId: self.name
      }
    });
  }

  rewrite(text: string) {
    sendMessage({
      event: 'terminal.rewrite', payload: {
        text,
        threadId: self.name
      }
    });
  }
}

class LocalEcho {
  println(text: string) {
    sendMessage({
      event: 'localecho.println', payload: {
        threadId: self.name,
        text
      }
    });
  }

  printWide(text: string[] | any) {
    sendMessage({
      event: 'localecho.printWide', payload: {
        threadId: self.name,
        text
      }
    });
  }
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

interface StateChart {
  next: any;
  dataset: ChartDataset<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar", DefaultDataPoint<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar">>;
  datasets: ChartDataset<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar", DefaultDataPoint<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar">>[];
  data: ChartData<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar", DefaultDataPoint<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar">, unknown>;
  chart: Chart<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar", DefaultDataPoint<"bar" | "line" | "scatter" | "bubble" | "pie" | "doughnut" | "polarArea" | "radar">, unknown>;
}

interface ConfigurationChart {
  type: keyof ChartTypeRegistry;
  data: any;
  options?: any;
  plugins?: ChartComponent[];
  scan?: (stateChart: StateChart) => void;
}

async function buildChart(config: ConfigurationChart) {
  const payload = await requestPlot({
    event: 'plot', payload: {
      threadId: self.name
    }
  }) as any;
  Chart.register(config.plugins ?? []);
  const chart = new Chart(payload.canvas, {
    type: config.type,
    data: config.data,
    options: config.options
  });
  payload.canvas.width = payload.width;
  payload.canvas.height = payload.height;
  chart.resize();
  return chart;
}

class ProcessWorker {
  constructor(private environment: any, private localEcho: LocalEcho, private terminal: Terminal) {
    environment.P = P
    environment.Pattern = Pattern
    environment.isMatching = isMatching
    environment.match = match
    environment.regex = (expr: RegExp) => P.when((str: string): str is never => expr.test(str));
    environment.Immutable = Immutable;
    environment.clear = tap(() => this.terminal.clear());
    environment.help = from([
      'clear - clears the output',
      `connect(protocol, options) - connects to some node using a protocol and its options.`,
      'echo(message) - displays the message on the terminal',
      'fromFetch(input) - fetch some web api resource',
      'Learn more on https://carlos-eduardo-sanchez-torres.sanchezcarlosjr.com/Assisting-dementia-patients-with-the-Embodied-Voice-Assistant-Eva-Simulator-at-CICESE-9aade1ebef9948acafba73d834b19d0b#0a45eb21f25a4551ba920e35165dce1e'
    ])
      .pipe(tap(message => this.localEcho.println(message)));
    environment.tap = tap;
    environment.map = map;
    environment.reduce = reduce;
    environment.math = math;
    environment.generate = generate;
    environment.scan = scan;
    environment.filter = filter;
    environment.range = range;
    environment.ImagesAccepted = ".jpg, .png, .jpeg, .svg, .gif, .bmp, .tif, .tiff|image/*";
    environment.delayWhen = delayWhen;
    environment.serialize = (obj: any, spaces?: number) => {
      try {
        return JSON.stringify(obj, (key: string, value: any) => {
          return match(value)
            .with(
              P.instanceOf(FileList), (fileList: FileList) => ({
                fileList: Immutable.Range(0, fileList.length).reduce(
                  (acc, index) => acc.push({
                    index,
                    name: fileList.item(index)?.name,
                    size: fileList.item(index)?.size,
                    type: fileList.item(index)?.type,
                    lastModified: fileList.item(index)?.lastModified,
                    webkitRelativePath: fileList.item(index)?.webkitRelativePath
                  }), Immutable.List<any>([])
                )
              })
            ).with(P.instanceOf(Function), (func: Function) => func.toString())
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
    environment.doAside = (...operations: UnaryFunction<any, any>[]) =>
      // @ts-ignore
      tap((value: any) => of(value).pipe(...operations).subscribe())
      ;
    // Consult https://www.twilio.com/docs/sms/api#send-messages-with-the-sms-api
    environment.sendSMS = (options: { from?: string, to?: string, account_sid: string, auth_token: string}) => switchMap((body: any) =>
      fromFetch(`https://api.twilio.com/2010-04-01/Accounts/${options.account_sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${options.account_sid}:${options.auth_token}`),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'From': body?.From  ?? options.from,
          'Body': body?.Body ?? body,
          'To': body?.To ?? options.to
        })
      }).pipe(catchError(err => of({ error: true, message: err.message })), map(_ => body))
    );
    environment.ce = new ComputeEngine();
    environment.sendEmail = (options: { type?: string, provider?: string, personalizations?: any, token: string, proxy?: string, to: string | string[], from: string, subject: string }) =>
      switchMap(state =>
        fromFetch(
          options?.proxy ? `${options.proxy}https%3A%2F%2Fapi.sendgrid.com%2Fv3%2Fmail%2Fsend` : "https://api.sendgrid.com/v3/mail/send",
          {
            method: 'POST',
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${options.token}`
            },
            body: JSON.stringify(
              {
                "personalizations": options.personalizations ?? [
                  {
                    "to": Array.isArray(options?.to) ? options.to.map(email => ({ email })) : [
                      {
                        email: options?.to ?? ""
                      }
                    ]
                  }
                ],
                "from": {
                  email: options?.from ?? ""
                },
                subject: options?.subject ?? "[EvaNotebook] Data from your notebook",
                "content": [
                  {
                    "type": options.type ?? "text/plain",
                    "value": state
                  }
                ]
              })
          }).pipe(map(_ => state))
      );
    environment.meanAnnotation = (datasetIndex = 0, borderColor = 'black') => ({
      type: 'line',
      borderColor,
      borderDash: [6, 6],
      borderDashOffset: 0,
      borderWidth: 3,
      label: {
        display: true,
        content: (ctx: any) => 'Mean: ' + math.mean(ctx.chart.data.datasets[datasetIndex].data).toFixed(2),
        position: 'end'
      },
      scaleID: 'y',
      value: (ctx: any) => math.mean(ctx.chart.data.datasets[datasetIndex].data)
    });
    environment.simpleDataLabels = () => ({
      backgroundColor: function (context: any) {
        return context.dataset.backgroundColor
      },
      borderRadius: 4,
      color: 'white',
      font: {
        weight: 'bold'
      },
      formatter: Math.round,
      padding: 6
    });
    environment.minAnnotation = (datasetIndex = 0, borderColor = 'black') => ({
      type: 'line',
      borderColor,
      borderWidth: 3,
      label: {
        display: true,
        backgroundColor: 'black',
        borderColor: 'black',
        borderRadius: 10,
        borderWidth: 2,
        content: (ctx: any) => 'Lower bound: ' + math.min(ctx.chart.data.datasets[datasetIndex].data).toFixed(2),
        rotation: 'auto'
      },
      scaleID: 'y',
      value: (ctx: any) => math.min(ctx.chart.data.datasets[datasetIndex].data).toFixed(2)
    });
    environment.maxAnnotation = (datasetIndex = 0, borderColor = 'black') => ({
      type: 'line',
      borderColor,
      borderWidth: 3,
      label: {
        display: true,
        backgroundColor: 'black',
        borderColor: 'black',
        borderRadius: 10,
        borderWidth: 2,
        content: (ctx: any) => 'Upper bound: ' + math.max(ctx.chart.data.datasets[datasetIndex].data).toFixed(2),
        rotation: 'auto'
      },
      scaleID: 'y',
      value: (ctx: any) => math.max(ctx.chart.data.datasets[datasetIndex].data).toFixed(2)
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
    environment.throwError = (error: Error) => {
      throw error;
    }
    environment.annotationPlugin = annotationPlugin;
    environment.ChartDataLabels = ChartDataLabels;
    environment.basicStatisticsAnnotations = (datasetIndex = 0, borderColor = 'black') => ({
      meanAnnotation: environment.meanAnnotation(datasetIndex, borderColor),
      minAnnotation: environment.minAnnotation(datasetIndex, borderColor),
      maxAnnotation: environment.maxAnnotation(datasetIndex, borderColor),
      meanMinusStandardDeviationAnnotation: environment.meanMinusStandardDeviationAnnotation(datasetIndex, borderColor),
      meanPlusStandardDeviationAnnotation: environment.meanPlusStandardDeviationAnnotation(datasetIndex, borderColor),
    });
    environment.println = (observerOrNext: any) => this.localEcho.println(environment.serialize(observerOrNext, 1)?.replace(/\\u002F/g, "/"));
    environment.display = tap(environment.println);
    environment.log = tap(observer => console.log(observer));
    environment.input = (options: PromptInputParams) =>
      observeResource('prompt', {
        event: 'prompt',
        payload: {
          threadId: self.name,
          options
        }
      });
    environment.prompt = (options: PromptInputParams) => switchMap(_ => environment.input(options));
    environment.compress = (options: { quality: number }) => switchMap((input: string) => observeResource('compress', {
      event: 'compress',
      payload: {
        threadId: self.name,
        input,
        options
      }
    }).pipe(first()));
    environment.decompress = switchMap((input: string) => observeResource('decompress', {
      event: 'decompress',
      payload: {
        threadId: self.name,
        input,
      }
    }).pipe(first()));
    environment.pipe = pipe;
    environment.NEVER = NEVER;
    environment.throttleTime = throttleTime;
    environment.forever = switchMap(() => NEVER);
    environment.chat = (observable: Observable<any> | Function) => pipe(
      filter((configuration: any) => configuration.ready),
      switchMap((configuration: any) =>
        (typeof observable === "function" ? observable(configuration.message) : observable).pipe(tap(next => configuration.connection.send(next))))
    );
    environment.sendOverProtocol = tap((configuration: any) => configuration.connection.send(configuration.message));
    environment.randint = (min = 0, max = 10) => Math.floor(Math.random() * (max - min)) + min;
    environment.fromFetch = (input: string | Request, init?: RequestInit | undefined) => fromFetch(input, init).pipe(
      switchMap((response) =>
        match(response).with(
          P.when(r => r.ok && /JSON/gi.test(r.headers.get("Content-Type") ?? "")),
          (r) => from(r.json())
        ).with(
          P.when(r => r.ok && /octet-stream/gi.test(r.headers.get("Content-Type") ?? "")),
          (r) => from(r.blob())
        ).with(
          P.when(r => r.ok && /form-data/gi.test(r.headers.get("Content-Type") ?? "")),
          (r) => from(r.formData())
        ).with(P.when(r => r.ok), (r) => from(r.text())).otherwise(() => of({
          error: true,
          message: `The HTTP status is ${response.status}. For more information consult https://developer.mozilla.org/en-US/docs/Web/HTTP/Status.`
        }))
      ),
      catchError(err => of({ error: true, message: err.message }))
    );
    environment.readFiles = pipe(
      map((fileList: FileList) => Immutable.Range(0, fileList.length).map(
        (index) => from(readFile(index, fileList)) as Observable<any>
      )
      ),
      switchMap((v: Indexed<Observable<any>>): any => v.get(0)?.pipe(mergeWith(v.slice(1, v.size).toArray())))
    );
    environment.importFiles = (options: any) => observeResource('shell.InputFile', {
      event: 'file', payload: {
        threadId: self.name,
        ...options
      }
    });
    // Consult https://jsonforms.io/ to learn more about options.
    environment.form = (options: { uischema: object, schema: object, data: any }) => observeResource('form', {
      event: 'form',
      payload: {
        threadId: self.name
      }
    }).pipe(first(),switchMap((port: MessagePort) => new Observable((observer) => {
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
      interval(200).pipe(
        startWith(0),
        takeWhile(_ => !ready)
      ).subscribe(_ =>
        port.postMessage({type: "ready"})
      );
    })));
    environment.plot = (config: ConfigurationChart) => pipe(
      switchScan(async (acc, next) => {
        const chart = await acc;
        config.scan?.({ dataset: chart.data.datasets[0], next, datasets: chart.data.datasets, data: chart.data, chart });
        chart.update();
        return acc;
      }, buildChart(config)),
      environment.forever
    );
    environment.chart = (config: ConfigurationChart) => of(undefined).pipe(environment.plot(config));
    environment.delayEach = (milliseconds: number) => delayWhen((_, i) => interval(i * milliseconds));
    environment.importJSON = (options: any) => environment.importFiles({
      ...options,
      accept: "application/json"
    }).pipe(
      environment.readFiles,
      map((file: { text: string }) => environment.deserialize(file.text))
    );
    environment.filterErrors = pipe(map(
      (x: { message: string }) => x.message), environment.display, filter((x: { error: boolean }) => x.error));
    environment.jp = jp;
    environment.jpquery = (path: string) => map((ob: object) => jp.query(ob, path));
    environment.jpapply = (path: string, fn: (x: any) => any) => map((ob: object) => jp.apply(ob, path, fn));
    environment.write = (f = identity) => tap((observerOrNext: string) => this.terminal?.write(f(observerOrNext)));
    environment.rewrite = (f = identity) => tap((observerOrNext: string) => this.terminal?.rewrite(f(observerOrNext)));
    environment.render = (x: string) => of(x).pipe(
      environment.write()
    );
    environment.printWide =
      tap(observerOrNext => this.localEcho.printWide(Array.isArray(observerOrNext) ? observerOrNext : environment.throwError(new Error(`TypeError: The operator printWide only supports iterators. ${observerOrNext} has to be an iterator.`))));
    environment.echo = (msg: any) => of(msg).pipe(filter(x => !!x), environment.display);
    environment.publishMQTT =
      (topic: string, payloadName: string = "text", options = { publication: {}, message: {} }) =>
        map((payload: string) => ({
          topic,
          message: environment.serialize({ [`${payloadName}`]: payload, ...options.message }),
          ...options.publication
        }));
    environment.sayHermes = environment.publishMQTT("hermes/tts/say");
    environment.gpt = (options: any) => switchMap((message: string) =>
      from(generateChatGPTRequest(message, options)).pipe(switchMap(request => environment.fromFetch(request)
        .pipe(
          filter((x: any) => !x.error),
          map((response: any) => response.choices[0].message.content)
        )))
    );
    // @ts-ignore
    environment.connect = (protocol: string, options: any) => protocols[protocol] ?
      // @ts-ignore
      (new protocols[protocol]()).connect(options) :
      of({ error: true, message: `Error: ${protocol} is not available.` })
  }

  println(next: any) {
    console.log(next)
    match(next)
      .with(
          P.string, (next: string) => this.terminal.rewrite(next)
      ).otherwise(next => this.environment.println(next))
  }

  spawn(content: string) {
    return eval(content);
  }

  exec(action: string) {
    return this.spawn(action);
  }
}

const processWorker = new ProcessWorker(globalThis, new LocalEcho(), new Terminal());

// @ts-ignore
globalThis.addEventListener('exec', async (event: CustomEvent) => {
  if (!event.detail.payload) {
    sendMessage({ 'event': 'shell.Stop', payload: { threadId: self.name } });
    return;
  }
  try {
    const response = await processWorker.exec(event.detail.payload.code);
    if (!(response instanceof Observable)) {
      processWorker.println(response);
      sendMessage({ 'event': 'shell.Stop', payload: { threadId: self.name } });
      return;
    }
    response.subscribe({
      // @ts-ignore
      complete: () => sendMessage({ 'event': 'shell.Stop', payload: { threadId: self.name } })
    });
  } catch (e) {
    // @ts-ignore
    sendMessage({ 'event': 'shell.error', payload: { threadId: self.name, text: `${e.name}: ${e.message}` } });
  }
});

self.onmessage = (event) => globalThis.dispatchEvent(new CustomEvent(event.data.event, {
  bubbles: true,
  detail: {
    payload: event.data.payload
  }
}));
