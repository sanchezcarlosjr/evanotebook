import * as rx from "rxjs";
import {
  catchError,
  delay,
  delayWhen,
  filter,
  from,
  interval,
  map,
  Observable,
  of,
  pipe,
  range,
  reduce,
  scan,
  startWith,
  switchMap,
  switchScan,
  take,
  tap, throwError
} from "rxjs";
import {fromFetch} from "rxjs/fetch";
import * as protocols from '../protocols';
import * as jp from 'jsonpath';
import { match, P, Pattern, isMatching } from 'ts-pattern';
import * as Immutable  from "immutable";

// @ts-ignore
globalThis.P = P
// @ts-ignore
globalThis.Pattern = Pattern
// @ts-ignore
globalThis.isMatching = isMatching
// @ts-ignore
globalThis.match = match
// @ts-ignore
globalThis.regex = (expr: RegExp) => P.when((str: string): str is never => expr.test(str));
// @ts-ignore
globalThis.Immutable = Immutable;

function sendMessage(message: any) {
  self.postMessage(message);
}

class RequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestError";
  }
}

// @ts-ignore
globalThis.database = {
  retrieve: (key: string) => new Promise((resolve, reject) => {
    // @ts-ignore
    globalThis.addEventListener('localStorage.getItem', (event: CustomEvent) => {
      resolve(event.detail.payload);
      // @ts-ignore
      globalThis.removeEventListener('localStorage.getItem', null);
    });
    sendMessage({event: 'localStorage.getItem', payload: {key}});
  }),
  save: (key: string, value: string) => new Promise((resolve, reject) => {
    resolve(value);
    if (!value)
      return null;
    sendMessage({event: 'localStorage.setItem', payload: {key, value}});
    return value;
  }),
  removeItem: (key: string) => new Promise((resolve, reject) => {
    resolve(key);
    if (!key)
      return null;
    sendMessage({event: 'localStorage.removeItem', payload: {key}});
    return key;
  })
}

function requestPrompt(text: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    globalThis.addEventListener('prompt', (event: CustomEvent) => {
      resolve(event.detail.payload);
      // @ts-ignore
      globalThis.removeEventListener('prompt', null);
    });
    // @ts-ignore
    sendMessage({
      event: 'prompt', payload: {
        threadId: self.name,
        text: text ?? ""
      }
    });
  });
}

const speechSynthesis = {
  speak: (text: string) => {
    // @ts-ignore
    sendMessage({event: 'speak', payload: text});
  }
}

//@ts-ignore
globalThis.throwError = (error: Error) => {
  throw error;
}

async function retrieveFromCache(key: string) {
  // @ts-ignore
  const token = await globalThis.database.retrieve(key) ?? await globalThis.database.save(key, await requestPrompt(`Write your ${key}. We save tokens on your local storage.`));
  if (!token) {
    //@ts-ignore
    globalThis.throwError(new ReferenceError(`${key} is not defined.`));
  }
  return token;
}

async function generateChatGPTRequest(content: string, options: {token: string, messages: {role: string, content: string}[]}) {
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
          ...options.messages
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

class ProcessWorker {
  constructor(private environment: any, private localEcho: LocalEcho, private terminal: Terminal) {
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
    environment.scan = scan;
    environment.filter = filter;
    environment.range = range;
    environment.delayWhen = delayWhen;
    environment.serialize = (obj: any) => {
      try {
        return JSON.stringify(obj);
      } catch (e) {
        return obj.toString();
      }
    };
    environment.deserialize = (code: string) => {
      try {
        return JSON.parse(code);
      } catch (e) {
        return code;
      }
    };
    environment.from = from;
    environment.of = of;
    environment.interval = interval;
    environment.startWith = startWith;
    environment.switchScan = switchScan;
    environment.delay = delay;
    environment.speak = tap((text: string) => speechSynthesis.speak(text));
    environment.take = take;
    environment.switchMap = switchMap;
    environment.rx = rx;
    environment.sendSMS = (options: {passcode: string, path: string, recipients: string[]}) => switchMap(message =>
      fromFetch(options.path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passcode: options.passcode,
          message,
          recipients: options.recipients.join(',')
        }),
      }).pipe(catchError(err =>  of({error: true, message: err.message})), map(_ => message))
    );
    environment.sendEmail = (options: { type?: string, provider?: string, personalizations?: any, token: string, proxy?: string, to: string|string[], from: string, subject: string }) =>
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
                    "to": Array.isArray(options?.to) ? options.to.map(email => ({email})) :  [
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
      )
    environment.display = (func = identity) => tap(observerOrNext =>
      this.localEcho.println(environment.serialize(func(observerOrNext)).replace(/\\u002F/g, "/"))
    );
    environment.input = (placeholder: string) => from(requestPrompt(placeholder));
    environment.prompt = (placeholder: string) => switchMap(_ => environment.input(placeholder));
    environment.chat = (observable: Observable<any> | Function) => pipe(
      filter((configuration: any) => configuration.ready),
      switchMap((configuration: any) =>
        (typeof observable === "function" ? observable(configuration.message) : observable).pipe(tap(next => configuration.connection.send(next))))
    );
    environment.sendOverProtocol  =   tap((configuration: any) => configuration.connection.send(configuration.message));
    environment.randomBetween = (max = 0, min = 10) => Math.floor(Math.random() * (max - min + 1)) + min;
    environment.fromFetch = (input: string | Request, init?: RequestInit | undefined) => fromFetch(input, init).pipe(
      switchMap((response: any) => response.ok ? response.json() :
        of({
          error: true,
          message: `The HTTP status is ${response.status}. For more information consult https://developer.mozilla.org/en-US/docs/Web/HTTP/Status.`
        })
      ),
      catchError(err => of({error: true, message: err.message}))
    );
    environment.filterErrors = pipe(environment.display((x: { message: string }) => x.message), filter((x: { error: boolean }) => x.error));
    environment.jp = jp;
    environment.jpquery = (path: string) => map((ob: object) => jp.query(ob, path));
    environment.jpapply = (path: string, fn: (x: any) => any) => map((ob: object) => jp.apply(ob, path, fn));
    environment.write = (f = identity) => tap((observerOrNext: string) => this.terminal?.write(f(observerOrNext)));
    environment.printWide =
      tap(observerOrNext => this.localEcho.printWide(Array.isArray(observerOrNext) ? observerOrNext : environment.throwError(new Error(`TypeError: The operator printWide only supports iterators. ${observerOrNext} has to be an iterator.`))));
    environment.echo = (msg: any) => of(msg).pipe(filter(x => !!x), environment.display());
    environment.publishMQTT =
      (topic: string, payload: string = "text", options = {publication: {}, message: {}}) =>
        map((payload: string) => ({
          topic,
          message: environment.serialize({[`${payload}`]: payload, ...options.message}),
          ...options.publication
        }));
    environment.sayHermes = environment.publishMQTT("hermes/tts/say");
    environment.gpt = (options: any) => switchMap((message: string) =>
      from(generateChatGPTRequest(message, options)).pipe(switchMap(request => environment.fromFetch(request)
        .pipe(
          tap((x: { error: boolean }) => {
            if (x.error) {
              // @ts-ignore
              globalThis.database.removeItem("token-OpenIA");
              // @ts-ignore
              globalThis.throwError(new RequestError(`${x.message}`));
            }
          }),
          filter((x: any) => !x.error),
          map((response: any) => response.choices[environment.randomBetween(response.choices.length - 1, 0)].message.content)
        )))
    );
    // @ts-ignore
    environment.connect = (protocol: string, options: any) => protocols[protocol] ?
      // @ts-ignore
      (new protocols[protocol]()).connect(options) :
      of({error: true, message: `Error: ${protocol} is not available.`})
  }

  spawn(action: string) {
    return new Function(`return ${action}`);
  }

  exec(action: string) {
    return this.spawn(action)();
  }
}

const processWorker = new ProcessWorker(globalThis, new LocalEcho(), new Terminal());

// @ts-ignore
globalThis.addEventListener('exec', async (event: CustomEvent) => {
  if (!event.detail.payload) {
    sendMessage({'event': 'shell.Stop', payload: {threadId: self.name}});
    return;
  }
  // @ts-ignore
  globalThis.db = event.detail.payload.database;
  try {
    const response = await processWorker.exec(event.detail.payload.code);
    response.subscribe({
      // @ts-ignore
      complete: () => sendMessage({'event': 'shell.Stop', payload: {threadId: self.name}})
    });
  } catch (e) {
    // @ts-ignore
    sendMessage({'event': 'shell.error', payload: {threadId: self.name, text: `${e.name}: ${e.message}`}});
  }
});

self.onmessage = (event) => globalThis.dispatchEvent(new CustomEvent(event.data.event, {
  bubbles: true,
  detail: {
    payload: event.data.payload
  }
}))
