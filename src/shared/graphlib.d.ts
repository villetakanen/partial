declare module 'graphlib' {
  interface GraphOptions {
    directed?: boolean
    multigraph?: boolean
    compound?: boolean
  }

  interface Edge {
    v: string
    w: string
    name?: string
  }

  class Graph {
    constructor(opts?: GraphOptions)
    setNode(name: string, label?: unknown): this
    hasNode(name: string): boolean
    node(name: string): unknown
    nodes(): string[]
    setEdge(v: string, w: string, label?: unknown): this
    edge(v: string, w: string): unknown
    edges(): Edge[]
    predecessors(name: string): string[] | undefined
    successors(name: string): string[] | undefined
    inEdges(name: string): Edge[] | undefined
    outEdges(name: string): Edge[] | undefined
    nodeCount(): number
    edgeCount(): number
  }

  export { Graph, Edge }
}
