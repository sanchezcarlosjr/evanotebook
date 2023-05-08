import { BehaviorSubject } from "rxjs";
import P2PNode from "./P2PNode";
import * as url from "./url";

describe("P2PNode", () => {
  const relay = "/ip4/127.0.0.1/tcp/45953/ws/p2p/12D3KooWCu8QaK4ouR31Mnm5VqikafGCyCSNNEEdHRTQxXx4es5e";

  beforeEach(() => {
  });

  it("should create an instance of P2PNode", () => {
    const p2pNode = new P2PNode();
    expect(p2pNode).toBeDefined();
  });

  it('should initialize', async () => {
    const p2pNode = new P2PNode();
    await p2pNode.initialize([relay]);
    expect(p2pNode).toBeDefined();
    expect(await p2pNode.multiaddress).not.toEqual("");
    expect(p2pNode.getConnections()).toContain(relay);
  });

});
