import { Component, OnInit } from '@angular/core';
import P2PNode from "../notebook/shell/P2PNode";
import * as url from "../notebook/shell/url";

@Component({
  selector: 'app-p2p',
  templateUrl: './p2p.component.html',
  styleUrls: ['./p2p.component.css']
})
export class P2PComponent implements OnInit {
  nodes = [new P2PNode(), new P2PNode(), new P2PNode(), new P2PNode(), new P2PNode()];
  multiaddress = ["", "", "", "", "", ""];
  async ngOnInit(): Promise<void> {
    const multiaddress = url.read('mas').split(",");
    // Node A
    await this.nodes[0].initialize(multiaddress);
    this.multiaddress[0] = await this.nodes[0].multiaddress;

    // Node B
    await this.nodes[1].initialize([...multiaddress,this.multiaddress[0]]);
    this.multiaddress[1] = await this.nodes[1].multiaddress;

    // Node D
    await this.nodes[2].initialize([...multiaddress,this.multiaddress[1]]);
    this.multiaddress[2] = await this.nodes[2].multiaddress;

    // Node C
    await this.nodes[3].initialize([...multiaddress,this.multiaddress[0]]);
    this.multiaddress[3] = await this.nodes[3].multiaddress;

    // Node E
    await this.nodes[4].initialize([...multiaddress,this.multiaddress[2], this.multiaddress[3]]);
    this.multiaddress[4] = await this.nodes[4].multiaddress;

  }
}
