// Shared task constants (status + category) used by the API, the tasks page
// and the dashboard, so labels/colours stay in one place.

export const TASK_CATEGORIES = [
  { value: 'ADMINISTRATIF', label: 'Administratif', color: '#60A5FA' },
  { value: 'SECURITE', label: 'Sécurité', color: '#F87171' },
  { value: 'LOGISTIQUE', label: 'Logistique', color: '#FBBF24' },
  { value: 'COMMUNICATION', label: 'Communication', color: '#A78BFA' },
  { value: 'GENERAL', label: 'Général', color: '#9CA3AF' },
] as const

export type TaskCategory = (typeof TASK_CATEGORIES)[number]['value']

export const TASK_CATEGORY_VALUES = TASK_CATEGORIES.map((c) => c.value) as [
  TaskCategory,
  ...TaskCategory[],
]

export function categoryMeta(value: string) {
  return TASK_CATEGORIES.find((c) => c.value === value) ?? TASK_CATEGORIES[4]
}

// Pipeline statuses. `done` is derived as status === 'VALIDE'.
export const TASK_STATUSES = [
  { value: 'EN_ATTENTE', label: 'En attente', color: '#9CA3AF' },
  { value: 'EN_COURS', label: 'En cours', color: '#FBBF24' },
  { value: 'VALIDE', label: 'Validé', color: '#22C55E' },
  { value: 'IMPOSSIBLE', label: 'Impossible', color: '#EF4444' },
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]['value']

export const TASK_STATUS_VALUES = TASK_STATUSES.map((s) => s.value) as [
  TaskStatus,
  ...TaskStatus[],
]

export function statusMeta(value: string) {
  return TASK_STATUSES.find((s) => s.value === value) ?? TASK_STATUSES[0]
}

/** `done` mirrors the VALIDE status so existing dashboard reminders keep working. */
export function doneFromStatus(status: string): boolean {
  return status === 'VALIDE'
}
