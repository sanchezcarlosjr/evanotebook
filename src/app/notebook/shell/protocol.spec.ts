import { firstValueFrom } from "rxjs";
import { GearProtocol } from "./protocols";
import { GearKeyring } from "@gear-js/api";
import {environment} from '../../../environments/environment.test';


describe('Protocol Test', () => {
  it('should receive messages from Vara Network', async () => {
      const gear = new GearProtocol();
      const response = await firstValueFrom(gear.connect());
      expect(response).toBeDefined();
  });
  it('should call Gear protocol as RPC', async () => {
    const gear = new GearProtocol({
        metadataPlainText: "0001000100000000010000000001010000000102000000000000000104000000b10214000000050200040824696e7465726661636518416374696f6e000108104e616d650000000c41676500010000080824696e74657266616365144576656e74000108104e616d650400000118537472696e670000000c41676504000c010c753634000100000c0000050600100824696e746572666163652854616d61676f7463686900000801106e616d65000118537472696e67000134646174655f6f665f62697274680c010c7536340000"
    });
    const response = await gear.send({
       keyrings: [await GearKeyring.fromMnemonic(environment.gear.mnemonic, 'name')],
       destination: '0xc0069f913407a432bbedfd423db91ba6c8f27e1a0b5bbe323b244e697108682f',
       payload: {
         Name: null
      }
    });
    expect(response).toContain("[RS] José Ricardo Cedeño García");
});
});
