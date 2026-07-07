export type RbxlSourceFormat = "rbxl" | "rbxlx" | "rbxm" | "rbxmx" | "unknown";

export type RbxlSnapshot = {
  schema: "bloxlab.robloxDom.v1";
  source: {
    fileName: string;
    format: RbxlSourceFormat;
  };
  rootId: string;
  nodes: Record<string, RbxlNode>;
};

export type RbxlNode = {
  Id: string;
  ClassName: string;
  Name: string;
  ParentId: string | null;
  ChildIds: string[];
  Properties: Record<string, RbxlProperty>;
};

export type RbxlProperty = {
  Type: string;
  Value: unknown;
};

export type RbxlClassCount = {
  className: string;
  count: number;
};

export type RbxlSummary = {
  nodeCount: number;
  meshPartCount: number;
  scriptCount: number;
  topClasses: RbxlClassCount[];
};

export type RbxlTreeRow = {
  id: string;
  node: RbxlNode;
  depth: number;
  childCount: number;
  isMatch: boolean;
};
