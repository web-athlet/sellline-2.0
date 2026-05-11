'use client';

import { Building2, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export interface OrgTreeNode {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  children?: OrgTreeNode[];
}

interface NodeProps {
  node: OrgTreeNode;
  depth: number;
}

function TreeNode({ node, depth }: NodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <li>
      <div
        className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-slate-50 group"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
            className="text-slate-400 hover:text-slate-700"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
        <Link
          href={`/organizations/${node.id}`}
          className="flex-1 font-medium text-slate-800 hover:text-indigo-600 hover:underline truncate"
        >
          {node.name}
        </Link>
        {node.industry && (
          <span className="hidden text-xs text-slate-400 group-hover:inline">{node.industry}</span>
        )}
        {node.employeeCount != null && (
          <span className="hidden text-xs text-slate-400 group-hover:inline">
            {node.employeeCount} MA
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <ul>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

interface Props {
  nodes: OrgTreeNode[];
  className?: string;
}

export function OrgTree({ nodes, className = '' }: Props) {
  if (nodes.length === 0) {
    return <p className="text-sm text-slate-400 py-4">Keine Organisationen.</p>;
  }

  return (
    <ul className={`space-y-0.5 ${className}`} role="tree" aria-label="Organisations-Hierarchie">
      {nodes.map((node) => (
        <TreeNode key={node.id} node={node} depth={0} />
      ))}
    </ul>
  );
}
