// Shared partner constants (kind + pipeline status + contribution types) used by
// the API and the Partenaires page, so labels/colours stay in one place.

export const PARTNER_KINDS = [
  { value: 'SPONSOR', label: 'Sponsor' },
  { value: 'INSTITUTION', label: 'Institution' },
  { value: 'SECOURS', label: 'Secours' },
  { value: 'PRESSE', label: 'Presse' },
  { value: 'EXPOSANT', label: 'Artisan / Exposant' },
  { value: 'AUTRE', label: 'Autre' },
] as const

export type PartnerKind = (typeof PARTNER_KINDS)[number]['value']
export const PARTNER_KIND_VALUES = PARTNER_KINDS.map((k) => k.value) as [PartnerKind, ...PartnerKind[]]
export function partnerKindMeta(value: string) {
  return PARTNER_KINDS.find((k) => k.value === value) ?? PARTNER_KINDS[PARTNER_KINDS.length - 1]
}

// Prospection pipeline.
export const PARTNER_STATUSES = [
  { value: 'A_CONTACTER', label: 'À contacter', color: '#9CA3AF' },
  { value: 'CONTACTE', label: 'Contacté', color: '#60A5FA' },
  { value: 'REFLEXION', label: 'En réflexion', color: '#FBBF24' },
  { value: 'ACCEPTE', label: 'Accepté', color: '#22C55E' },
  { value: 'CONFIRME', label: 'Confirmé', color: '#16A34A' },
  { value: 'REFUSE', label: 'Refusé', color: '#EF4444' },
] as const

export type PartnerStatus = (typeof PARTNER_STATUSES)[number]['value']
export const PARTNER_STATUS_VALUES = PARTNER_STATUSES.map((s) => s.value) as [PartnerStatus, ...PartnerStatus[]]
export function partnerStatusMeta(value: string) {
  return PARTNER_STATUSES.find((s) => s.value === value) ?? PARTNER_STATUSES[0]
}

// What a partner can bring.
export const PARTNER_CONTRIBUTIONS = [
  { value: 'ARGENT', label: 'Argent', color: '#16A34A' },
  { value: 'PRODUITS', label: 'Produits', color: '#7C3AED' },
  { value: 'SERVICES', label: 'Services', color: '#2563EB' },
  { value: 'PERSONNES', label: 'Personnes', color: '#EA580C' },
  { value: 'STAND', label: 'Stand', color: '#DB2777' },
] as const

export type PartnerContribution = (typeof PARTNER_CONTRIBUTIONS)[number]['value']
export const PARTNER_CONTRIBUTION_VALUES = PARTNER_CONTRIBUTIONS.map((c) => c.value) as [
  PartnerContribution,
  ...PartnerContribution[],
]
export function partnerContributionMeta(value: string) {
  return PARTNER_CONTRIBUTIONS.find((c) => c.value === value) ?? PARTNER_CONTRIBUTIONS[0]
}
