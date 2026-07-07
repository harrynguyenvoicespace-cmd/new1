import type { RbxlClassCount, RbxlNode, RbxlSnapshot, RbxlSummary, RbxlTreeRow } from "./types";

const SCRIPT_CLASS_NAMES = new Set(["Script", "LocalScript", "ModuleScript"]);

export function getNode(snapshot: RbxlSnapshot | null, id: string): RbxlNode | null {
  return snapshot?.nodes[id] ?? null;
}

export function getRoot(snapshot: RbxlSnapshot | null): RbxlNode | null {
  if (!snapshot) return null;
  return getNode(snapshot, snapshot.rootId);
}

export function getChildren(snapshot: RbxlSnapshot, node: RbxlNode): RbxlNode[] {
  return node.ChildIds.map((id) => snapshot.nodes[id]).filter(Boolean);
}

export function countClasses(snapshot: RbxlSnapshot | null): RbxlClassCount[] {
  if (!snapshot) return [];

  const counts = new Map<string, number>();
  for (const node of Object.values(snapshot.nodes)) {
    counts.set(node.ClassName, (counts.get(node.ClassName) ?? 0) + 1);
  }

  return Array.from(counts, ([className, count]) => ({ className, count })).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.className.localeCompare(b.className);
  });
}

export function summarizeSnapshot(snapshot: RbxlSnapshot): RbxlSummary {
  const nodes = Object.values(snapshot.nodes);

  return {
    nodeCount: nodes.length,
    meshPartCount: nodes.filter((node) => node.ClassName === "MeshPart").length,
    scriptCount: nodes.filter((node) => SCRIPT_CLASS_NAMES.has(node.ClassName)).length,
    topClasses: countClasses(snapshot).slice(0, 8),
  };
}

export function filterTree(snapshot: RbxlSnapshot | null, query: string): RbxlTreeRow[] {
  if (!snapshot) return [];

  const normalizedQuery = query.trim().toLowerCase();
  const visibleIds = normalizedQuery ? collectVisibleIds(snapshot, normalizedQuery) : null;
  const rows: RbxlTreeRow[] = [];
  const stack: Array<{ id: string; depth: number }> = [{ id: snapshot.rootId, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;

    const node = snapshot.nodes[current.id];
    if (!node) continue;

    if (!visibleIds || visibleIds.has(current.id)) {
      rows.push({
        id: current.id,
        node,
        depth: current.depth,
        childCount: node.ChildIds.length,
        isMatch: normalizedQuery ? nodeMatches(node, normalizedQuery) : false,
      });
    }

    for (let index = node.ChildIds.length - 1; index >= 0; index -= 1) {
      const childId = node.ChildIds[index];
      if (!visibleIds || visibleIds.has(childId)) {
        stack.push({ id: childId, depth: current.depth + 1 });
      }
    }
  }

  return rows;
}

function collectVisibleIds(snapshot: RbxlSnapshot, query: string) {
  const visibleIds = new Set<string>();

  for (const node of Object.values(snapshot.nodes)) {
    if (!nodeMatches(node, query)) continue;

    let current: RbxlNode | undefined = node;
    while (current) {
      visibleIds.add(current.Id);
      current = current.ParentId ? snapshot.nodes[current.ParentId] : undefined;
    }
  }

  return visibleIds;
}

function nodeMatches(node: RbxlNode, query: string) {
  return `${node.Name} ${node.ClassName}`.toLowerCase().includes(query);
}
