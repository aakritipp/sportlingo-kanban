import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Search, SlidersHorizontal, LayoutGrid, Calendar,
  Flag, X, Trash2, ChevronDown, UserPlus, Users, Tag,
  CheckCircle2, Clock, AlertCircle, Inbox, BarChart3,
} from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'

// ─── Constants ───
const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'var(--accent-blue)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--accent-orange)' },
  { id: 'in_review', label: 'In Review', color: 'var(--accent-purple)' },
  { id: 'done', label: 'Done', color: 'var(--accent-green)' },
]

const LABEL_PRESETS = [
  { name: 'Bug', color: '#e63946', bg: '#fde8ea' },
  { name: 'Feature', color: '#4361ee', bg: '#eef0fd' },
  { name: 'Design', color: '#7b2cbf', bg: '#f3ebfa' },
  { name: 'Docs', color: '#2ec4b6', bg: '#e8f8f6' },
  { name: 'Urgent', color: '#f77f00', bg: '#fef3e6' },
]

const AVATAR_COLORS = [
  '#4361ee', '#e63946', '#2ec4b6', '#7b2cbf', '#f77f00',
  '#d62828', '#457b9d', '#e76f51', '#6a994e', '#bc6c25',
]

// ─── Helper: get initials ───
function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Helper: due date info ───
function getDueDateInfo(dueDate) {
  if (!dueDate) return null
  const diff = differenceInDays(parseISO(dueDate), new Date())
  if (diff < 0) return { label: 'Overdue', className: 'overdue' }
  if (diff === 0) return { label: 'Today', className: 'due-soon' }
  if (diff <= 2) return { label: `${diff}d left`, className: 'due-soon' }
  return { label: format(parseISO(dueDate), 'MMM d'), className: '' }
}

// ═══════════════════════════════════════
// Sortable Task Card
// ═══════════════════════════════════════
function SortableTaskCard({ task, teamMembers, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dueInfo = getDueDateInfo(task.due_date)
  const assignees = (task.assignee_ids || [])
    .map(id => teamMembers.find(m => m.id === id))
    .filter(Boolean)

  const labels = task.labels || []

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${isDragging ? 'dragging' : ''}`}
      onClick={(e) => { e.stopPropagation(); onClick(task) }}
    >
      {labels.length > 0 && (
        <div className="task-card-labels">
          {labels.map((l, i) => {
            const preset = LABEL_PRESETS.find(p => p.name === l)
            return (
              <span key={i} className="label-badge" style={{
                background: preset?.bg || '#f0f0f0',
                color: preset?.color || '#666',
              }}>{l}</span>
            )
          })}
        </div>
      )}
      <div className="task-card-title">{task.title}</div>
      {task.description && <div className="task-card-desc">{task.description}</div>}
      <div className="task-card-footer">
        <div className="task-card-meta">
          {task.priority && task.priority !== 'normal' && (
            <span className="task-meta-item">
              <span className={`priority-dot ${task.priority}`} />
              {task.priority}
            </span>
          )}
          {dueInfo && (
            <span className={`task-meta-item ${dueInfo.className}`}>
              <Calendar />
              {dueInfo.label}
            </span>
          )}
        </div>
        {assignees.length > 0 && (
          <div className="assignee-stack">
            {assignees.slice(0, 3).map((m, i) => (
              <div key={m.id} className="assignee-avatar"
                style={{ background: m.color }}
                title={m.name}>
                {getInitials(m.name)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Column Component
// ═══════════════════════════════════════
function Column({ column, tasks, teamMembers, onTaskClick, isOver }) {
  const { setNodeRef: setDroppableRef, isOver: isDroppableOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: 'column', columnId: column.id },
  })

  return (
    <div className="column">
      <div className="column-header">
        <div className="column-header-left">
          <div className={`column-dot ${column.id}`} />
          <span className="column-name">{column.label}</span>
          <span className="column-count">{tasks.length}</span>
        </div>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setDroppableRef} className={`column-body ${(isOver || isDroppableOver) ? 'drag-over' : ''}`}>
          {tasks.length === 0 ? (
            <div className="empty-column">
              <Inbox />
              <span>No tasks yet</span>
            </div>
          ) : (
            tasks.map(task => (
              <SortableTaskCard
                key={task.id}
                task={task}
                teamMembers={teamMembers}
                onClick={onTaskClick}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ═══════════════════════════════════════
// Create Task Modal
// ═══════════════════════════════════════
function CreateTaskModal({ onClose, onSubmit, teamMembers }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'normal',
    due_date: '', status: 'todo', labels: [], assignee_ids: [],
  })
  const titleRef = useRef()

  useEffect(() => { titleRef.current?.focus() }, [])

  const handleSubmit = () => {
    if (!form.title.trim()) return
    onSubmit(form)
  }

  const toggleLabel = (name) => {
    setForm(f => ({
      ...f,
      labels: f.labels.includes(name) ? f.labels.filter(l => l !== name) : [...f.labels, name]
    }))
  }

  const toggleAssignee = (id) => {
    setForm(f => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(id)
        ? f.assignee_ids.filter(a => a !== id)
        : [...f.assignee_ids, id]
    }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Task</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Title</label>
            <input ref={titleRef} placeholder="What needs to be done?"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea placeholder="Add some details..." rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Labels</label>
            <div className="label-picker">
              {LABEL_PRESETS.map(lp => (
                <span key={lp.name}
                  className={`label-option ${form.labels.includes(lp.name) ? 'selected' : ''}`}
                  style={{ background: lp.bg, color: lp.color }}
                  onClick={() => toggleLabel(lp.name)}>
                  {lp.name}
                </span>
              ))}
            </div>
          </div>
          {teamMembers.length > 0 && (
            <div className="form-group">
              <label>Assignees</label>
              <div className="team-selector">
                {teamMembers.map(m => (
                  <span key={m.id}
                    className={`team-option ${form.assignee_ids.includes(m.id) ? 'selected' : ''}`}
                    onClick={() => toggleAssignee(m.id)}>
                    <div className="assignee-avatar" style={{ background: m.color, width: 20, height: 20, fontSize: 9 }}>
                      {getInitials(m.name)}
                    </div>
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>Create Task</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Task Detail Panel
// ═══════════════════════════════════════
function TaskDetailPanel({ task, onClose, onDelete, onUpdate, teamMembers }) {
  const dueInfo = getDueDateInfo(task.due_date)
  const assignees = (task.assignee_ids || []).map(id => teamMembers.find(m => m.id === id)).filter(Boolean)

  return (
    <div className="detail-panel-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="detail-panel-header">
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600 }}>{task.title}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="detail-panel-body">
          <div className="detail-field">
            <span className="detail-field-label">Status</span>
            <select value={task.status} style={{ padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: 13 }}
              onChange={e => onUpdate(task.id, { status: e.target.value })}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {task.description && (
            <div className="detail-field">
              <span className="detail-field-label">Description</span>
              <span className="detail-field-value">{task.description}</span>
            </div>
          )}
          <div className="detail-field">
            <span className="detail-field-label">Priority</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={`priority-dot ${task.priority}`} />
              <span className="detail-field-value" style={{ textTransform: 'capitalize' }}>{task.priority || 'Normal'}</span>
            </div>
          </div>
          {task.due_date && (
            <div className="detail-field">
              <span className="detail-field-label">Due Date</span>
              <span className={`detail-field-value ${dueInfo?.className || ''}`}>
                {format(parseISO(task.due_date), 'MMMM d, yyyy')}
                {dueInfo && ` · ${dueInfo.label}`}
              </span>
            </div>
          )}
          {(task.labels || []).length > 0 && (
            <div className="detail-field">
              <span className="detail-field-label">Labels</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {task.labels.map((l, i) => {
                  const p = LABEL_PRESETS.find(lp => lp.name === l)
                  return <span key={i} className="label-badge" style={{ background: p?.bg, color: p?.color }}>{l}</span>
                })}
              </div>
            </div>
          )}
          {assignees.length > 0 && (
            <div className="detail-field">
              <span className="detail-field-label">Assignees</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {assignees.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="assignee-avatar" style={{ background: m.color }}>{getInitials(m.name)}</div>
                    <span style={{ fontSize: 13 }}>{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="detail-field">
            <span className="detail-field-label">Created</span>
            <span className="detail-field-value">{format(parseISO(task.created_at), 'MMMM d, yyyy · h:mm a')}</span>
          </div>
        </div>
        <div className="detail-actions">
          <button className="btn-danger" onClick={() => { onDelete(task.id); onClose() }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trash2 size={14} /> Delete Task</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// Main App
// ═══════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailTask, setDetailTask] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [overColumnId, setOverColumnId] = useState(null)
  const [filterPriority, setFilterPriority] = useState(null)
  const [filterLabel, setFilterLabel] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [teamMembers, setTeamMembers] = useState([])
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // ─── Auth ───
  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
        } else {
          const { data, error } = await supabase.auth.signInAnonymously()
          if (error) throw error
          setUser(data.user)
        }
      } catch (err) {
        setError('Failed to create guest session. Check your Supabase config.')
        setLoading(false)
      }
    }
    init()
  }, [])

  // ─── Load tasks ───
  useEffect(() => {
    if (!user) return
    async function loadTasks() {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
        if (error) throw error
        setTasks(data || [])
      } catch (err) {
        setError('Failed to load tasks.')
      } finally {
        setLoading(false)
      }
    }
    loadTasks()

    // Load team members from local storage (kept client-side for simplicity)
    const saved = localStorage.getItem(`team_${user.id}`)
    if (saved) setTeamMembers(JSON.parse(saved))
  }, [user])

  // ─── Save team to localStorage ───
  useEffect(() => {
    if (user && teamMembers.length >= 0) {
      localStorage.setItem(`team_${user.id}`, JSON.stringify(teamMembers))
    }
  }, [teamMembers, user])

  // ─── Create task ───
  const createTask = async (form) => {
    try {
      const { data, error } = await supabase.from('tasks').insert({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        due_date: form.due_date || null,
        status: form.status,
        labels: form.labels,
        assignee_ids: form.assignee_ids,
        user_id: user.id,
      }).select().single()
      if (error) throw error
      setTasks(prev => [...prev, data])
      setShowCreate(false)
    } catch (err) {
      setError('Failed to create task.')
    }
  }

  // ─── Update task ───
  const updateTask = async (id, updates) => {
    try {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id)
      if (error) throw error
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
      if (detailTask?.id === id) setDetailTask(prev => ({ ...prev, ...updates }))
    } catch (err) {
      setError('Failed to update task.')
    }
  }

  // ─── Delete task ───
  const deleteTask = async (id) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      setError('Failed to delete task.')
    }
  }

  // ─── Add team member ───
  const addTeamMember = () => {
    if (!newMemberName.trim()) return
    const member = {
      id: crypto.randomUUID(),
      name: newMemberName.trim(),
      color: AVATAR_COLORS[teamMembers.length % AVATAR_COLORS.length],
    }
    setTeamMembers(prev => [...prev, member])
    setNewMemberName('')
    setShowAddMember(false)
  }

  // ─── DnD handlers ───
  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragOver = (event) => {
    const { over } = event
    if (!over) { setOverColumnId(null); return }
    // Figure out which column we're over
    const overTask = tasks.find(t => t.id === over.id)
    if (overTask) {
      setOverColumnId(overTask.status)
    } else if (String(over.id).startsWith('column-')) {
      setOverColumnId(String(over.id).replace('column-', ''))
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)
    setOverColumnId(null)
    if (!over) return

    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) return

    // Determine destination column
    let destColumn = null
    const overTask = tasks.find(t => t.id === over.id)
    if (overTask) {
      destColumn = overTask.status
    } else if (String(over.id).startsWith('column-')) {
      destColumn = String(over.id).replace('column-', '')
    }

    if (destColumn && destColumn !== activeTask.status) {
      updateTask(activeTask.id, { status: destColumn })
    }
  }

  // ─── Filter tasks ───
  const filteredTasks = tasks.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (filterLabel && !(t.labels || []).includes(filterLabel)) return false
    return true
  })

  const getColumnTasks = (colId) => filteredTasks.filter(t => t.status === colId)
  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  // ─── Stats ───
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date || t.status === 'done') return false
    return differenceInDays(parseISO(t.due_date), new Date()) < 0
  }).length
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /><span className="loading-text">Setting up your board...</span></div>
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <LayoutGrid size={22} />
          <span>TaskFlow</span>
        </div>

        <div>
          <div className="sidebar-section-title">Board</div>
          <nav className="sidebar-nav">
            <div className="sidebar-item active">
              <LayoutGrid size={18} /> My Board
            </div>
          </nav>
        </div>

        <div>
          <div className="sidebar-section-title">Team</div>
          <div className="team-panel">
            <div className="team-list">
              {teamMembers.map(m => (
                <div key={m.id} className="team-member-row">
                  <div className="assignee-avatar" style={{ background: m.color }}>{getInitials(m.name)}</div>
                  <span className="team-member-name">{m.name}</span>
                </div>
              ))}
            </div>
            {showAddMember ? (
              <div className="add-member-inline">
                <input
                  placeholder="Name"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTeamMember()}
                  autoFocus
                />
                <button onClick={addTeamMember}>Add</button>
              </div>
            ) : (
              <button className="add-member-btn" onClick={() => setShowAddMember(true)}>
                <UserPlus size={16} /> Add member
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-stats">
          <div className="sidebar-section-title" style={{ marginBottom: 10 }}>Overview</div>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{totalTasks}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{doneTasks}</span>
              <span className="stat-label">Done</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{inProgressTasks}</span>
              <span className="stat-label">Active</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: overdueTasks > 0 ? 'var(--accent-red)' : undefined }}>{overdueTasks}</span>
              <span className="stat-label">Overdue</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">My Board</span>
          </div>
          <div className="topbar-right">
            <div className="search-box">
              <Search />
              <input placeholder="Search tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <X size={14} color="var(--text-tertiary)" />
                </button>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button className={`filter-btn ${(filterPriority || filterLabel) ? 'active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}>
                <SlidersHorizontal /> Filter
                {(filterPriority || filterLabel) && (
                  <span style={{ background: 'var(--accent-blue)', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>
                    {[filterPriority, filterLabel].filter(Boolean).length}
                  </span>
                )}
              </button>
              {showFilters && (
                <div className="filter-dropdown">
                  <div className="filter-section">
                    <div className="filter-section-title">Priority</div>
                    {['high', 'normal', 'low'].map(p => (
                      <div key={p} className={`filter-option ${filterPriority === p ? 'active' : ''}`}
                        onClick={() => setFilterPriority(filterPriority === p ? null : p)}>
                        <span className={`priority-dot ${p}`} />
                        <span style={{ textTransform: 'capitalize' }}>{p}</span>
                      </div>
                    ))}
                  </div>
                  <div className="filter-section">
                    <div className="filter-section-title">Label</div>
                    {LABEL_PRESETS.map(lp => (
                      <div key={lp.name} className={`filter-option ${filterLabel === lp.name ? 'active' : ''}`}
                        onClick={() => setFilterLabel(filterLabel === lp.name ? null : lp.name)}>
                        <span className="label-badge" style={{ background: lp.bg, color: lp.color, fontSize: 11 }}>{lp.name}</span>
                      </div>
                    ))}
                  </div>
                  {(filterPriority || filterLabel) && (
                    <button style={{
                      width: '100%', padding: '6px', border: 'none', background: 'var(--bg-hover)',
                      borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-body)', marginTop: 4
                    }}
                      onClick={() => { setFilterPriority(null); setFilterLabel(null) }}>
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus /> New Task
            </button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="board">
            {COLUMNS.map(col => (
              <Column
                key={col.id}
                column={col}
                tasks={getColumnTasks(col.id)}
                teamMembers={teamMembers}
                onTaskClick={setDetailTask}
                isOver={overColumnId === col.id}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="task-card" style={{ transform: 'rotate(3deg)', boxShadow: 'var(--shadow-lg)' }}>
                <div className="task-card-title">{activeTask.title}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Modals */}
      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onSubmit={createTask}
          teamMembers={teamMembers}
        />
      )}

      {detailTask && (
        <TaskDetailPanel
          task={detailTask}
          teamMembers={teamMembers}
          onClose={() => setDetailTask(null)}
          onDelete={deleteTask}
          onUpdate={updateTask}
        />
      )}

      {/* Error toast */}
      {error && (
        <div className="toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* Click outside to close filters */}
      {showFilters && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowFilters(false)} />
      )}
    </div>
  )
}
