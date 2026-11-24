import React, { useState } from 'react';
import { PersonalTask } from '../types';
import { CheckCircle2, Circle, Plus, Bell, Trash2, Sparkles } from 'lucide-react';
import { useSeasonalTheme } from '../utils/seasonalTheme';

interface Props {
  tasks: PersonalTask[];
  isVisitor?: boolean;
  onUpdateTasks: (tasks: PersonalTask[]) => void;
}

export const PersonalTasksManager: React.FC<Props> = ({ tasks, isVisitor = false, onUpdateTasks }) => {
  const { tokens: themeTokens } = useSeasonalTheme();
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newCategory, setNewCategory] = useState<PersonalTask['category']>('guardia');
  const [newPriority, setNewPriority] = useState<PersonalTask['priority']>('media');
  const newDueTime = '12:00';
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('🏥 Hospital Materno Infantil', {
          body: 'Notificaciones activadas para recordatorios diarios de guardia.',
          icon: '/favicon.ico'
        });
      }
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: PersonalTask = {
      id: 'task-' + Date.now(),
      title: newTitle.trim(),
      description: newDesc.trim(),
      category: newCategory,
      priority: newPriority,
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: newDueTime,
      completed: false,
      reminderActive: true,
      createdAt: new Date().toISOString()
    };

    onUpdateTasks([newTask, ...tasks]);
    setNewTitle('');
    setNewDesc('');
  };

  const handleToggleTask = (taskId: string) => {
    const updated = tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    onUpdateTasks(updated);
  };

  const handleDeleteTask = (taskId: string) => {
    onUpdateTasks(tasks.filter(t => t.id !== taskId));
  };

  const filteredTasks = tasks.filter(t => {
    if (filterCategory === 'ALL') return true;
    return t.category === filterCategory;
  });

  return (
    <div className={`${themeTokens.cardSurface} border rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-5 sm:space-y-6 overflow-hidden`}>
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border-b ${themeTokens.sectionDivider} pb-4`}>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${themeTokens.accentIcon}`} />
            Gestión Minimalista de Tareas Personales & Guardia
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Pendientes diarios, rondas médicas y recordatorios sincronizados en la nube.
          </p>
        </div>

        <button
          onClick={requestNotificationPermission}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Bell className="w-4 h-4 text-teal-500" />
          Activar Notificaciones Push
        </button>
      </div>

      {/* Add Task Form (Oculto en Modo Visita) */}
      {!isVisitor && (
        <form
          onSubmit={handleAddTask}
          data-tutorial="tareas-add-form"
          className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Título del pendiente (ej: Revisar gasometría en Traumashock)..."
              className="md:col-span-6 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
            />

            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value as PersonalTask['category'])}
              className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-900 dark:text-slate-100"
            >
              <option value="guardia">Guardia</option>
              <option value="médica">Médica</option>
              <option value="pendiente_lab">Laboratorio</option>
              <option value="alta">Alta Médica</option>
              <option value="personal">Personal</option>
            </select>

            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value as PersonalTask['priority'])}
              className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-slate-900 dark:text-slate-100"
            >
              <option value="alta">Alta Prioridad</option>
              <option value="media">Media Prioridad</option>
              <option value="baja">Baja Prioridad</option>
            </select>

            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="md:col-span-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg px-3 py-2 flex items-center justify-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
        </form>
      )}

      {/* Task Category Tabs */}
      <div data-tutorial="tareas-categories" className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {['ALL', 'guardia', 'médica', 'pendiente_lab', 'alta', 'personal'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 capitalize ${
              filterCategory === cat
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {cat === 'ALL' ? 'Todas las Tareas' : cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div data-tutorial="tareas-list" className="space-y-2">
        {filteredTasks.length === 0 ? (
          <p className="text-center text-xs text-slate-600 dark:text-slate-400 py-6 italic">No hay tareas registradas en esta categoría.</p>
        ) : (
          filteredTasks.map(task => (
            <div
              key={task.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                task.completed
                  ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/60 opacity-60'
                  : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => !isVisitor && handleToggleTask(task.id)} 
                  disabled={isVisitor}
                  className={`text-teal-500 transition-colors ${isVisitor ? 'cursor-default opacity-80' : 'hover:text-teal-400 cursor-pointer'}`}
                  title={isVisitor ? 'Solo lectura en modo visita' : (task.completed ? 'Marcar como pendiente' : 'Marcar como completada')}
                >
                  {task.completed ? <CheckCircle2 className="w-5 h-5 text-teal-500" /> : <Circle className="w-5 h-5 text-slate-400" />}
                </button>
                <div>
                  <p className={`text-xs font-bold ${task.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="capitalize font-semibold text-teal-600 dark:text-teal-400">{task.category.replace('_', ' ')}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`font-bold ${task.priority === 'alta' ? 'text-red-500' : 'text-amber-500'}`}>
                      Prioridad {task.priority}
                    </span>
                  </div>
                </div>
              </div>

              {!isVisitor && (
                <button
                  type="button"
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-slate-400 hover:text-red-500 p-1 transition-colors cursor-pointer"
                  title="Eliminar Tarea"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
