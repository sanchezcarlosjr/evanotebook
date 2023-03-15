import {Shell} from './shell/shell';
describe('shell', () => {
  let terminal = {
    underlying: {
      clear: () => {}
    }
  };
  let localEcho = {
    println: () => {},
    history: {
      push: () => {}
    }
  };
  beforeEach(() => {
    spyOn(terminal.underlying, 'clear');
    spyOn(localEcho, 'println');
  });
  it('exec code', () => {
    const shell = new Shell(localEcho,terminal, globalThis);
    shell.fork("clear").subscribe();
    expect(localEcho.println).toHaveBeenCalled();
    expect(terminal.underlying.clear).toHaveBeenCalled();
  });
});
