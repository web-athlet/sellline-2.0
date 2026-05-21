'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { useState } from 'react';
import type { Task, CreateTaskInput } from '@/lib/projects-api';

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string, done: boolean) => void;
  onDelete: (taskId: string) => void;
}

function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="task-item"
      className={`flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 ${
        isDragging ? 'opacity-40 shadow-lg' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Aufgabe verschieben"
        className="mt-0.5 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
      >
        ⠿
      </button>

      <input
        type="checkbox"
        checked={task.done}
        onChange={(e) => onToggle(task.id, e.target.checked)}
        aria-label={`Aufgabe ${task.done ? 'erledigt' : 'ausstehend'}: ${task.title}`}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${task.done ? 'line-through text-slate-400' : 'text-slate-900'}`}>
          {task.title}
        </p>
        {task.dueDate && (
          <p className="text-xs text-slate-500">
            Fällig: {new Date(task.dueDate).toLocaleDateString('de-DE')}
          </p>
        )}
        {task.assignee && <p className="text-xs text-slate-500">{task.assignee.name}</p>}
      </div>

      <button
        onClick={() => onDelete(task.id)}
        aria-label={`Aufgabe löschen: ${task.title}`}
        className="ml-auto text-slate-300 hover:text-red-500 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

interface Props {
  tasks: Task[];
  projectId: string;
  onCreateTask: (input: CreateTaskInput) => Promise<void>;
  onToggleTask: (taskId: string, done: boolean) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onReorderTask: (taskId: string, newOrder: number) => Promise<void>;
}

export function ProjectTaskList({
  tasks,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onReorderTask,
}: Props) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  // Sync from parent when tasks prop changes (after refetch)
  if (tasks !== localTasks && !adding) {
    setLocalTasks(tasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = localTasks.findIndex((t) => t.id === String(active.id));
    const newIndex = localTasks.findIndex((t) => t.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localTasks, oldIndex, newIndex);
    setLocalTasks(reordered);

    await onReorderTask(String(active.id), newIndex);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await onCreateTask({ title: newTitle.trim() });
      setNewTitle('');
    } finally {
      setAdding(false);
    }
  };

  const done = localTasks.filter((t) => t.done).length;
  const total = localTasks.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Aufgaben
          {total > 0 && (
            <span className="ml-2 text-slate-400 font-normal">
              {done}/{total}
            </span>
          )}
        </h3>
      </div>

      {total > 0 && (
        <div
          className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
          aria-label={`${done} von ${total} Tasks erledigt`}
        >
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }}
          />
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {localTasks.map((task) => (
              <TaskItem key={task.id} task={task} onToggle={onToggleTask} onDelete={onDeleteTask} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <form onSubmit={handleAddTask} className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Neue Aufgabe hinzufügen…"
          aria-label="Neue Aufgabe"
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          + Hinzufügen
        </button>
      </form>
    </div>
  );
}
