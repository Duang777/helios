import { CheckCircle2, CircleDot, FileCheck2, Gauge, GitBranch, LayoutDashboard, PenSquare, ScanSearch } from 'lucide-react';
import type { NodeRun, WorkflowNode, WorkflowTemplate } from '../api/types';
import { Badge, Button, Panel } from './ui/primitives';

interface WorkflowCanvasProps {
  workflow: WorkflowTemplate | null;
  selectedNodeId: string | null;
  nodeRuns: NodeRun[];
  onSelectNode: (nodeId: string) => void;
}

export function WorkflowCanvas({ workflow, selectedNodeId, nodeRuns, onSelectNode }: WorkflowCanvasProps) {
  if (!workflow) {
    return (
      <Panel className="canvas-panel empty-canvas" aria-label="Workflow canvas">
        <div className="empty-surface">No workflow compiled</div>
      </Panel>
    );
  }

  return (
    <Panel className="canvas-panel" aria-label="Workflow canvas">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Workflow DAG</p>
          <h2>{workflow.name}</h2>
        </div>
        <Badge className="scenario-pill">{workflow.scenario === 'skuflow' ? 'SKUFlow shell' : 'Generic kernel'}</Badge>
      </div>
      <div className="workflow-rail">
        {workflow.nodes.map((node, index) => {
          const run = nodeRuns.find((item) => item.nodeId === node.id);
          return (
            <div className="node-wrap" key={node.id}>
              <Button
                className={`workflow-node ${selectedNodeId === node.id ? 'is-selected' : ''}`}
                variant="secondary"
                type="button"
                onClick={() => onSelectNode(node.id)}
              >
                <span className="node-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="node-icon">{iconForNode(node)}</span>
                <span className="node-copy">
                  <span className="node-title">{node.title}</span>
                  <span className="node-meta">{node.type.replace('_', ' ')} · {node.dependencies.length ? `${node.dependencies.length} dependency` : 'entry node'}</span>
                </span>
                <span className={`node-status ${run ? 'done' : ''}`}>{run ? <CheckCircle2 size={17} /> : <CircleDot size={17} />}</span>
              </Button>
              {index < workflow.nodes.length - 1 ? <div className="edge-line" aria-hidden="true" /> : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function iconForNode(node: WorkflowNode) {
  switch (node.type) {
    case 'form':
      return <PenSquare size={18} />;
    case 'approval':
      return <FileCheck2 size={18} />;
    case 'dashboard':
      return <LayoutDashboard size={18} />;
    case 'report':
      return <Gauge size={18} />;
    case 'llm_task':
      return <ScanSearch size={18} />;
    default:
      return <GitBranch size={18} />;
  }
}
