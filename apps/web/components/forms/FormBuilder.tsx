'use client';

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { type FormField, FIELD_TYPE_LABEL } from '@/lib/leads-api';

function generateId(): string {
  return `field-${Math.random().toString(36).slice(2, 9)}`;
}

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABEL) as FormField['type'][];
const HAS_OPTIONS: FormField['type'][] = ['dropdown', 'radio'];

// ── Draggable library card ────────────────────────────────────────────────────

function LibraryCard({ type }: { type: FormField['type'] }) {
  return (
    <div className="cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm active:cursor-grabbing hover:border-indigo-300 hover:bg-indigo-50">
      {FIELD_TYPE_LABEL[type]}
    </div>
  );
}

// ── Sortable canvas field ─────────────────────────────────────────────────────

interface CanvasFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function CanvasField({ field, isSelected, onSelect, onRemove }: CanvasFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${
        isSelected
          ? 'border-indigo-400 bg-indigo-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        aria-label="Feld verschieben"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-indigo-500">
            {FIELD_TYPE_LABEL[field.type]}
          </span>
          {field.required && <span className="text-red-500 text-xs">*</span>}
        </div>
        <p className="truncate text-sm text-slate-700">{field.label || '(kein Label)'}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 rounded p-1 text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
        aria-label="Feld entfernen"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Drop-zone canvas ──────────────────────────────────────────────────────────

interface FieldCanvasProps {
  fields: FormField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

function FieldCanvas({ fields, selectedId, onSelect, onRemove }: FieldCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[400px] flex-1 rounded-xl border-2 border-dashed p-4 transition-colors ${
        isOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      {fields.length === 0 ? (
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-slate-400">
          <p className="text-sm">Felder hierher ziehen oder klicken</p>
        </div>
      ) : (
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {fields.map((field) => (
              <CanvasField
                key={field.id}
                field={field}
                isSelected={field.id === selectedId}
                onSelect={() => onSelect(field.id)}
                onRemove={() => onRemove(field.id)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

// ── Field settings panel ──────────────────────────────────────────────────────

interface FieldSettingsProps {
  field: FormField | null;
  onChange: (updated: FormField) => void;
}

function FieldSettings({ field, onChange }: FieldSettingsProps) {
  if (!field) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Feld auswählen um Einstellungen zu sehen
      </div>
    );
  }

  const update = (patch: Partial<FormField>) => onChange({ ...field, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 uppercase tracking-wide">
          Feldtyp
        </label>
        <p className="text-sm font-medium text-indigo-600">{FIELD_TYPE_LABEL[field.type]}</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 uppercase tracking-wide">
          Label
        </label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => update({ label: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {field.type !== 'checkbox' && field.type !== 'file' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 uppercase tracking-wide">
            Platzhalter
          </label>
          <input
            type="text"
            value={field.placeholder ?? ''}
            onChange={(e) => update({ placeholder: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="required"
          checked={field.required}
          onChange={(e) => update({ required: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
        />
        <label htmlFor="required" className="text-sm text-slate-700">
          Pflichtfeld
        </label>
      </div>

      {field.type !== 'checkbox' && field.type !== 'file' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 uppercase tracking-wide">
            Standardwert
          </label>
          <input
            type="text"
            value={field.defaultValue ?? ''}
            onChange={(e) => update({ defaultValue: e.target.value || undefined })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      )}

      {HAS_OPTIONS.includes(field.type) && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 uppercase tracking-wide">
            Optionen (eine pro Zeile)
          </label>
          <textarea
            rows={4}
            value={(field.options ?? []).join('\n')}
            onChange={(e) =>
              update({
                options: e.target.value.split('\n').filter((o) => o.trim().length > 0),
              })
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      )}
    </div>
  );
}

// ── Main FormBuilder ──────────────────────────────────────────────────────────

export interface FormBuilderProps {
  initialFields?: FormField[];
  onChange: (fields: FormField[]) => void;
}

export function FormBuilder({ initialFields = [], onChange }: FormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<FormField['type'] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectedField = fields.find((f) => f.id === selectedId) ?? null;

  function addField(type: FormField['type']) {
    const newField: FormField = {
      id: generateId(),
      type,
      label: FIELD_TYPE_LABEL[type],
      required: false,
    };
    const updated = [...fields, newField];
    setFields(updated);
    setSelectedId(newField.id);
    onChange(updated);
  }

  function updateField(updated: FormField) {
    const next = fields.map((f) => (f.id === updated.id ? updated : f));
    setFields(next);
    onChange(next);
  }

  function removeField(id: string) {
    const next = fields.filter((f) => f.id !== id);
    setFields(next);
    if (selectedId === id) setSelectedId(null);
    onChange(next);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    // Library drag: id is a field type like 'text', 'email', etc.
    if (FIELD_TYPES.includes(id as FormField['type'])) {
      setActiveType(id as FormField['type']);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveType(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Drop from library onto canvas
    if (FIELD_TYPES.includes(activeId as FormField['type'])) {
      if (overId === 'canvas' || fields.some((f) => f.id === overId)) {
        addField(activeId as FormField['type']);
      }
      return;
    }

    // Reorder within canvas
    if (activeId !== overId) {
      const oldIndex = fields.findIndex((f) => f.id === activeId);
      const newIndex = fields.findIndex((f) => f.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const next = arrayMove(fields, oldIndex, newIndex);
        setFields(next);
        onChange(next);
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-4">
        {/* Left: Field Library */}
        <div className="w-60 shrink-0 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Feld-Bibliothek
          </p>
          {FIELD_TYPES.map((type) => (
            <div
              key={type}
              onClick={() => addField(type)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && addField(type)}
            >
              <LibraryCard type={type} />
            </div>
          ))}
        </div>

        {/* Middle: Canvas */}
        <div className="flex-1 overflow-y-auto">
          <FieldCanvas
            fields={fields}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={removeField}
          />
        </div>

        {/* Right: Settings */}
        <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Einstellungen
          </p>
          <FieldSettings field={selectedField} onChange={updateField} />
        </div>
      </div>

      <DragOverlay>
        {activeType && (
          <div className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 shadow-lg">
            {FIELD_TYPE_LABEL[activeType]}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
