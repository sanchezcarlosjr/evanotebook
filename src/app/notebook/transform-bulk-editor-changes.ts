import {match,P} from "ts-pattern";

function groupById(changes: CustomEvent[]): Map<string, CustomEvent[]> {
  const groups = new Map<string, CustomEvent[]>();

  for (const change of changes) {
    const id = change.detail.target.id;
    const group = groups.get(id);
    if (!group) {
      groups.set(id, [change]);
    } else {
      group.push(change);
    }
  }

  return groups;
}

/*
      block-moved, block-added, block-moved, block-removed are the operations that editor gives us,
      however we have got to reduce the operations, thereby we apply the following rules (such as Pushdown Automata):
      X;Y,Z means X is the input, Y is the top of the stack, Z is the operation in the stack.
      For example:
      block-moved; block-moved, block-moved block-moved
      means block-moved is the input, block-moved is the top of the stack, we push the block-moved into the stack.
*/
function transformGroup(changes: CustomEvent[]): CustomEvent[] {
  const stack: CustomEvent[] = [];
  for (const change of changes) {
    match({ type: change.type, top: stack.length > 0 ? stack[stack.length - 1].type : null })
      .with({ type: P._, top: null }, () => stack.push(change))
      .with({ type: "block-moved", top: "block-moved" }, () => stack.push(change))
      .with({ type: "block-moved", top: "block-changed" }, () => stack.push(change))
      .with({ type: "block-moved", top: "block-added" }, () => stack.push(change))
      .with({ type: "block-moved", top: "block-removed" }, () => stack[stack.length-1] = change)
      .with({ type: "block-changed", top: "block-changed" }, () => stack[stack.length-1] = change)
      .with({ type: "block-changed", top: "block-moved" }, () => stack.push(change))
      .with({ type: "block-changed", top: "block-removed" }, () => stack[stack.length-1] = change)
      .with({ type: "block-changed", top: "block-added" }, () => stack[stack.length-1] = change)
      .with({ type: "block-removed", top: "block-removed" }, () => stack[stack.length-1] = change)
      .with({ type: "block-removed", top: "block-moved" }, () => stack.push(change))
      .with({ type: "block-removed", top: "block-added" }, () => stack[stack.length-1] = change)
      .with({ type: "block-removed", top: "block-changed" }, () => stack[stack.length-1] = change)
      .with({ type: "block-added", top: "block-moved" }, () => stack.push(change))
      .with({ type: "block-added", top: "block-changed" },
        () => stack[stack.length-1] = new CustomEvent("block-changed", { detail: change.detail })
      )
      .with({ type: "block-added", top: "block-added" }, () => stack[stack.length-1] = change)
      .with({ type: "block-added", top: "block-removed" },
        () => stack[stack.length-1] = new CustomEvent("block-changed", { detail: change.detail }))
      .run();
  }
  return stack;
}

export function transformBulkEditorChanges(changes: CustomEvent[]): CustomEvent[] {
  const groups = groupById(changes);
  const result: CustomEvent[] = [];
  groups.forEach((group) => {
    const transformedGroup = transformGroup(group);
    result.push(...transformedGroup);
  });
  return result;
}
