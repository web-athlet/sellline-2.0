'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState, useId } from 'react';

type BlockType = 'text' | 'image' | 'button' | 'divider' | 'spacer';

interface Block {
  id: string;
  type: BlockType;
  content: string;
}

interface SortableBlockProps {
  block: Block;
  onChange: (id: string, content: string) => void;
  onRemove: (id: string) => void;
}

function SortableBlock({ block, onChange, onRemove }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-lg border border-slate-200 bg-white p-3"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          {block.type === 'text' && (
            <textarea
              value={block.content}
              onChange={(e) => onChange(block.id, e.target.value)}
              placeholder="Text hier eingeben… Merge-Tags: {{firstName}}, {{orgName}}"
              className="w-full resize-none rounded border-0 p-0 text-sm focus:ring-0 focus:outline-none"
              rows={3}
            />
          )}
          {block.type === 'image' && (
            <input
              type="url"
              value={block.content}
              onChange={(e) => onChange(block.id, e.target.value)}
              placeholder="Bild-URL (https://…)"
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          )}
          {block.type === 'button' && (
            <div className="flex gap-2">
              <input
                type="text"
                value={block.content.split('|')[0] ?? ''}
                onChange={(e) =>
                  onChange(block.id, `${e.target.value}|${block.content.split('|')[1] ?? ''}`)
                }
                placeholder="Button-Text"
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
              />
              <input
                type="url"
                value={block.content.split('|')[1] ?? ''}
                onChange={(e) =>
                  onChange(block.id, `${block.content.split('|')[0] ?? ''}|${e.target.value}`)
                }
                placeholder="URL"
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
              />
            </div>
          )}
          {block.type === 'divider' && <hr className="border-slate-300" />}
          {block.type === 'spacer' && (
            <div className="h-8 rounded bg-slate-50 flex items-center justify-center text-xs text-slate-400">
              Abstand
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(block.id)}
          className="mt-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <span className="absolute top-1 right-8 text-[10px] text-slate-300 uppercase tracking-wide">
        {block.type}
      </span>
    </div>
  );
}

function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'text':
          return `<p style="margin:0 0 16px;">${b.content.replace(/\n/g, '<br/>')}</p>`;
        case 'image':
          return b.content
            ? `<img src="${b.content}" alt="" style="max-width:100%;display:block;margin:0 0 16px;" />`
            : '';
        case 'button': {
          const [label, url] = b.content.split('|');
          return label && url
            ? `<p style="text-align:center;margin:0 0 16px;"><a href="${url}" style="display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">${label}</a></p>`
            : '';
        }
        case 'divider':
          return '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />';
        case 'spacer':
          return '<div style="height:32px;"></div>';
        default:
          return '';
      }
    })
    .join('\n');
}

interface CampaignEmailEditorProps {
  value: string;
  onChange: (html: string) => void;
}

let blockCounter = 0;
const newId = () => `block-${++blockCounter}`;

const BLOCK_TYPES: Array<{ type: BlockType; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'image', label: 'Bild' },
  { type: 'button', label: 'Button' },
  { type: 'divider', label: 'Trennlinie' },
  { type: 'spacer', label: 'Abstand' },
];

export function CampaignEmailEditor({ value: _value, onChange }: CampaignEmailEditorProps) {
  const instanceId = useId();
  const [blocks, setBlocks] = useState<Block[]>([{ id: newId(), type: 'text', content: '' }]);
  const [preview, setPreview] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const notify = (b: Block[]) => {
    const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">${blocksToHtml(b)}</div>`;
    onChange(html);
  };

  const addBlock = (type: BlockType) => {
    const updated = [...blocks, { id: newId(), type, content: '' }];
    setBlocks(updated);
    notify(updated);
  };

  const updateBlock = (id: string, content: string) => {
    const updated = blocks.map((b) => (b.id === id ? { ...b, content } : b));
    setBlocks(updated);
    notify(updated);
  };

  const removeBlock = (id: string) => {
    const updated = blocks.filter((b) => b.id !== id);
    setBlocks(updated);
    notify(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      const updated = arrayMove(blocks, oldIndex, newIndex);
      setBlocks(updated);
      notify(updated);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {BLOCK_TYPES.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => addBlock(type)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          {preview ? 'Editor' : 'Vorschau'}
        </button>
      </div>

      {preview ? (
        <div
          className="min-h-40 rounded-lg border border-slate-200 bg-white p-4 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks) }}
        />
      ) : (
        <DndContext
          id={instanceId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  onChange={updateBlock}
                  onRemove={removeBlock}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
