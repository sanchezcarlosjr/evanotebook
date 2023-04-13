import { ComponentFixture, TestBed } from '@angular/core/testing';
import {addRxPlugin, createRxDatabase, RxCollection} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import {RxDatabase} from "rxdb/dist/types/types";
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import {DatabaseManager} from "./DatabaseManager";
import {first, firstValueFrom, map} from "rxjs";
addRxPlugin(RxDBUpdatePlugin);
(window as any).global = window;

describe('RxDB Playground', () => {
  let manager: DatabaseManager;
  beforeEach(async () => {
    manager = new DatabaseManager(this.titleSubject);
    await manager.start();
  });
  afterEach(async () => {
    await manager.destroy();
  });
  it('should compress and decompress a redundant string', async () => {
    const input = "aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbcccccccccccccccddddddddddddddddeeeeeeeeeeeeeeeefffffffffffffffff";
    const output = manager.compress(input);
    expect(input.length).toBeGreaterThanOrEqual(output.length);
    expect(output.length).toBeLessThan(btoa(input).length);
    expect(manager.decompress(output)).toEqual(input);
  });
  it('should compress and decompress the OutputData from EditorJS', async () => {
    const url = new URL("https://notebook.sanchezcarlosjr.com/?c=G3AAMIzTFfOihHUP%2Fptb6i%2BPsbttHxeiKIZiFVQQFozXOixdfZ1ywJw0D8MEc49u94CLl16x0jUFuGFailSsDrWWUN8%2FzuC9wDPHdqz7%2FU2izWAu33QTchBYE5hX%2FkUKXJ5duXM%3D");
    const input = url.searchParams.get("c") || "";
    const output = JSON.parse(manager.decompress(input));
    expect(output.blocks[0].data.text).toEqual("123");
    expect(manager.compress(JSON.stringify(output))).toEqual(input);
  });
  it('it should insert data and returns the most recent output data', async () => {
    const url = new URL("https://notebook.sanchezcarlosjr.com/?c=G3AAMIzTFfOihHUP%2Fptb6i%2BPsbttHxeiKIZiFVQQFozXOixdfZ1ywJw0D8MEc49u94CLl16x0jUFuGFailSsDrWWUN8%2FzuC9wDPHdqz7%2FU2izWAu33QTchBYE5hX%2FkUKXJ5duXM%3D");
    const input = url.searchParams.get("c") || "";
    const output = JSON.parse(manager.decompress(input));
    output.time = Date.now();
    await manager.insert('editor', structuredClone(output));
    expect((await firstValueFrom(manager.collection('editor')))).toEqual(output.time);
  });
  // TODO: clear event
  it('it should add and remove new blocks successfully', async () => {
    expect(await firstValueFrom(manager.collection('blocks'))).toEqual([]);
    let expectedObject = {
      id: "1",
      type: "paragraph",
      data: {}
    };
    await manager.addBlock(expectedObject);
    const result = await firstValueFrom(manager.collection('blocks'));
    expect({
      id: result[0].id,
      type: result[0].type,
      data: result[0].data
    }).toEqual(expectedObject);
    await manager.removeBlock(expectedObject.id);
    expect(await firstValueFrom(manager.collection('blocks'))).toEqual([]);
  });
  it('it should change a block successfully', async () => {
    let expectedObject = {
      id: "1",
      type: "paragraph",
      data: {
        text: ""
      }
    };
    await manager.addBlock(expectedObject);
    expectedObject.data = {text: "123"};
    await manager.changeBlock(expectedObject);
    const result = await firstValueFrom(manager.collection('blocks'));
    expect({ id: result[0].id, type: result[0].type, data: result[0].data }).toEqual(expectedObject);
    await manager.removeBlock(expectedObject.id);
  });
  it('it should update indexes greater than current one', async () => {
    const blocks = [{id: "1",index:0,type:"paragraph",data: {}},{id: "2",index:1,type: "paragraph", data: {}},{index:2, id: "3", type: "paragraph", data: {}}];
    for (const block of blocks) {
      await manager.addBlock(block);
    }
    await manager.increaseIndexes(1);
    await manager.addBlock({id: "13333",index:1,type: "paragraph", data: {}});
    let indexes = await firstValueFrom(manager.collection('blocks').pipe(map(b => b.map(x=>x.index))));
    expect(indexes).toEqual([0,1,2,3]);
    await manager.removeAllBlocks();
    indexes = await firstValueFrom(manager.collection('blocks').pipe(map(b => b.map(x=>x.index))));
    expect(indexes).toEqual([]);
  });
  fit('it should remove all blocks and then remove changes', async () => {
    const blocks = [{id: "1",index:0,type:"paragraph",data: {}},{id: "2",index:1,type: "paragraph", data: {}},{index:2, id: "3", type: "paragraph", data: {}}];
    for (const block of blocks) {
      await manager.addBlock(block);
    }
    await manager.removeAllBlocks();
    let indexes = await firstValueFrom(manager.collection('blocks').pipe(map(b => b.map(x=>x.index))));
    expect(indexes).toEqual([]);
    await manager.addBlock({id: "13333",index:0,type: "paragraph", data: {}});
    indexes = await firstValueFrom(manager.collection('blocks').pipe(map(b => b.map(x=>x.index))));
    expect(indexes).toEqual([0]);
  });
});
