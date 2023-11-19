import { App } from './app'
import { MemFS } from './memfs'
import { msToSec } from './shared'
import { Tar } from './tar'

const clangUrl = '/assets/clang/clang.wasm';
const lldUrl = '/assets/clang/lld.wasm';
const sysrootUrl = '/assets/clang/sysroot.tar';

export class API {
  constructor(options) {
    this.moduleCache = {}
    this.hostWrite = options.hostWrite
    this.showTiming = options.showTiming || true

    this.clangCommonArgs = [
      '-disable-free',
      '-isysroot',
      '/',
      '-internal-isystem',
      '/include/c++/v1',
      '-internal-isystem',
      '/include',
      '-internal-isystem',
      '/lib/clang/8.0.1/include',
      '-ferror-limit',
      '19',
      '-fmessage-length',
      '80',
      '-fcolor-diagnostics',
    ]

    this.memfs = new MemFS({
      hostWrite: this.hostWrite,
      hostRead: options.hostRead
    })
    this.ready = this.memfs.ready.then(() => {
      return this.untar(this.memfs, sysrootUrl)
    })
  }

  async getModule(name) {
    if (this.moduleCache[name]) return this.moduleCache[name]
    const module = await this.hostLogAsync(
      `Fetching and compiling ${name}`,
      (async () => {
        const response = await fetch(name)
        return WebAssembly.compile(await response.arrayBuffer())
      })()
    )
    this.moduleCache[name] = module
    return module
  }

  hostLog(message) {
    const yellowArrow = '\x1b[1;93m>\x1b[0m ';
    this.log(`${yellowArrow}${message}`);
  }

  log(message) {
    console.log(message);
  }

  async hostLogAsync(message, promise) {
    const start = +new Date()
    this.hostLog(`${message}...`)
    const result = await promise
    const end = +new Date()
    this.log(' done.')
    if (this.showTiming) {
      const green = '\x1b[92m'
      const normal = '\x1b[0m'
      this.log(` ${green}(${msToSec(start, end)}s)${normal}`)
    }
    return result
  }

  async untar(memfs, url) {
    await this.memfs.ready
    const promise = (async () => {
      const tar = new Tar(await fetch(url).then((result) => result.arrayBuffer()))
      tar.untar(this.memfs)
    })()
    await this.hostLogAsync(`Untarring ${url}`, promise)
  }

  async compile(options) {
    const input = options.input
    const contents = options.contents
    const obj = options.obj
    const opt = options.opt || '2'

    await this.ready
    this.memfs.addFile(input, contents)
    const clang = await this.getModule(clangUrl)
    return await this.run(
      clang,
      'clang',
      '-cc1',
      '-emit-obj',
      ...this.clangCommonArgs,
      '-O2',
      '-o',
      obj,
      '-x',
      'c++',
      input
    )
  }

  async link(obj, wasm) {
    const stackSize = 1024 * 1024

    const libdir = 'lib/wasm32-wasi'
    const crt1 = `${libdir}/crt1.o`

    await this.ready
    const lld = await this.getModule(lldUrl)
    return await this.run(
      lld,
      'wasm-ld',
      '--no-threads',
      '--export-dynamic', // TODO required?
      '-z',
      `stack-size=${stackSize}`,
      `-L${libdir}`,
      crt1,
      obj,
      '-lc',
      '-lc++',
      '-lc++abi',
      '-o',
      wasm
    )
  }

  async run(module, ...args) {
    this.hostLog(`${args.join(' ')}`)
    const start = +new Date()
    const app = new App(module, this.memfs, ...args)
    const instantiate = +new Date()
    const stillRunning = await app.run()
    const end = +new Date()
    if (this.showTiming) {
      const green = '\x1b[92m'
      const normal = '\x1b[0m'
      let msg = `${green}(${msToSec(start, instantiate)}s`
      msg += `/${msToSec(instantiate, end)}s)${normal}`
      this.log(msg)
    }
    return stillRunning ? app : null
  }

  async compileLinkRun(contents) {
    const input = `test.cc`
    const obj = `test.o`
    const wasm = `test.wasm`
    await this.compile({ input, contents, obj })
    await this.link(obj, wasm)

    const buffer = this.memfs.getFileContents(wasm)
    const testMod = await WebAssembly.compile(buffer)

    return await this.run(testMod, wasm)
  }
}
