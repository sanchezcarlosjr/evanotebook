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
    manager = new DatabaseManager();
    await manager.start();
  });
  afterEach(async () => {
    await manager.destroy();
  });
  it('should compress and decompress a redundant string', async () => {
    const input = "aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbcccccccccccccccddddddddddddddddeeeeeeeeeeeeeeeefffffffffffffffff";
    const output = await firstValueFrom(manager.compress(input));
    expect(input.length).toBeGreaterThanOrEqual(output.length);
    expect(output.length).toBeLessThan(btoa(input).length);
    expect(await firstValueFrom(manager.decompress(output))).toEqual(input);
  });
  it('should compress and decompress the OutputData from EditorJS', async () => {
    const url = new URL("https://notebook.sanchezcarlosjr.com/?c=G3AAMIzTFfOihHUP%2Fptb6i%2BPsbttHxeiKIZiFVQQFozXOixdfZ1ywJw0D8MEc49u94CLl16x0jUFuGFailSsDrWWUN8%2FzuC9wDPHdqz7%2FU2izWAu33QTchBYE5hX%2FkUKXJ5duXM%3D");
    const input = url.searchParams.get("c") || "";
    const output = JSON.parse(await firstValueFrom(manager.decompress(input)));
    expect(output.blocks[0].data.text).toEqual("123");
    expect(await firstValueFrom(manager.compress(JSON.stringify(output)))).toEqual(input);
  });
});
