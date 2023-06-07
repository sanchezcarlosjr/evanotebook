import {transformBulkEditorChanges} from "./transform-bulk-editor-changes";

fdescribe('Transform bulk editor changes', () => {
  it('should expect no changes', () => {
    const result = transformBulkEditorChanges([]);
    expect(result).toEqual([]);
  });

  it('should expect one change', () => {
    const changes = [new CustomEvent("block-added", {detail: {target: {id: "1"}}})];
    const result = transformBulkEditorChanges(changes);
    expect(result).toEqual(changes);
  });
  it('should transform mra to mc', () => {
    const changes = [
      new CustomEvent("block-moved", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1"}}})
    ];
    const result = transformBulkEditorChanges(changes);
    expect(result[0].type).toEqual("block-moved");
    expect(result[1].type).toEqual("block-changed");
    expect(result.length).toEqual(2);
  });

  it('should transform mc to mc', () => {
    const changes = [
      new CustomEvent("block-moved", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1"}}})
    ];
    const result = transformBulkEditorChanges(changes);
    expect(result[0].type).toEqual("block-moved");
    expect(result[1].type).toEqual("block-changed");
    expect(result.length).toEqual(2);
  });

  it('should transform m+r to r', () => {
    const changes = [
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "1"}}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "2"}}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "3"}}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "4"}}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "5"}}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}})
    ];
    const result = transformBulkEditorChanges(changes);
    expect(result[0].type).toEqual("block-removed");
    expect(result.length).toEqual(1);
  });

  it('should transform r+m+ to m', () => {
    const changes = [
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "1"}}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "2"}}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "3"}}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "4"}}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "5"}}}}),
    ];
    const result = transformBulkEditorChanges(changes);
    expect(result[0].type).toEqual("block-changed");
    expect(result[0].detail.target.data.text).toEqual("5");
    expect(result.length).toEqual(1);
  });

  it('should transform a+ to a', () => {
    const changes = [
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "1"}}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "2"}}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "3"}}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "4"}}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "5"}}}}),
    ];
    const result = transformBulkEditorChanges(changes);
    expect(result[0].type).toEqual("block-added");
    expect(result[0].detail.target.data.text).toEqual("5");
    expect(result.length).toEqual(1);
  });

  it('should transform (ra)+ to c', () => {
    const changes = [
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "1"}}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "2"}}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "3"}}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "4"}}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "5"}}}}),
    ];
    const result = transformBulkEditorChanges(changes);
    expect(result[0].type).toEqual("block-changed");
    expect(result[0].detail.target.data.text).toEqual("5");
    expect(result.length).toEqual(1);
  });

  it('should transform (ra)+c to c', () => {
    const changes = [
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "1"}}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "2"}}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "3"}}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "4"}}}}),
      new CustomEvent("block-removed", {detail: {target: {id: "1"}}}),
      new CustomEvent("block-added", {detail: {target: {id: "1", data: {text: "5"}}}}),
      new CustomEvent("block-changed", {detail: {target: {id: "1", data: {text: "6"}}}}),
    ];
    const result = transformBulkEditorChanges(changes);
    expect(result[0].type).toEqual("block-changed");
    expect(result[0].detail.target.data.text).toEqual("6");
    expect(result.length).toEqual(1);
  });

});
