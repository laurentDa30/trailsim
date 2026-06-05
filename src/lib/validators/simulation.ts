import { z } from "zod"

export const RunnerProfileSchema = z.object({
  label: z.string().min(1, "Label is required"),
  percentage: z.number().min(0).max(100),
  baseSpeedMin: z.number().min(1).max(30),
  baseSpeedMax: z.number().min(1).max(30),
  climbCoeff: z.number().min(0.1).max(5),
  descentCoeff: z.number().min(0.1).max(5),
  fatigueFactor: z.number().min(0).max(1),
  techSkill: z.number().min(0).max(1),
  ravitoDuration: z.number().int().min(0),
  abandonRate: z.number().min(0).max(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
})

export type RunnerProfile = z.infer<typeof RunnerProfileSchema>

export const SimulationCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  eventId: z.string().cuid(),
  totalRunners: z.number().int().min(1).max(10000).default(300),
  temperature: z.number().min(-20).max(50).default(18),
  wind: z.number().min(0).max(200).default(0),
  windDirection: z.number().min(0).max(360).default(0),
  rain: z.boolean().default(false),
  rainIntensity: z.number().min(0).max(100).default(0),
  fog: z.boolean().default(false),
  jamThreshold: z.number().int().min(2).max(100).default(10),
  ressources: z.string().optional(),
  runnerProfiles: z.array(RunnerProfileSchema).min(1, "At least one runner profile is required"),
})

export type SimulationCreate = z.infer<typeof SimulationCreateSchema>

export const EventCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  date: z.string().datetime({ offset: true }).optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
  location: z.string().optional(),
})

export type EventCreate = z.infer<typeof EventCreateSchema>

export const LoginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export type Login = z.infer<typeof LoginSchema>
