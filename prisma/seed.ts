import bcrypt from "bcryptjs"
import db from "../src/lib/db"

async function seed() {
  console.log("Seeding database...")

  // 1. Upsert demo user
  const passwordHash = bcrypt.hashSync("demo1234", 10)

  const user = await db.user.upsert({
    where: { email: "demo@trailsim.fr" },
    update: { name: "Organisateur Demo", passwordHash },
    create: {
      email: "demo@trailsim.fr",
      name: "Organisateur Demo",
      passwordHash,
    },
  })

  console.log(`Upserted user: ${user.email}`)

  // 2. Delete existing events for this user (clean slate)
  await db.event.deleteMany({ where: { userId: user.id } })
  console.log("Deleted existing events")

  // 3. Create event
  const event = await db.event.create({
    data: {
      name: "Trail des Aiguilles",
      location: "Chamonix-Mont-Blanc",
      date: new Date("2025-09-13"),
      userId: user.id,
    },
  })

  console.log(`Created event: ${event.name}`)

  // 4. Create 3 races
  const race50 = await db.race.create({
    data: {
      name: "50 km",
      color: "#7CB518",
      startTime: 0,
      distance: 50.2,
      elevGain: 3200,
      elevLoss: 3200,
      eventId: event.id,
    },
  })

  const race20 = await db.race.create({
    data: {
      name: "20 km",
      color: "#38BDF8",
      startTime: 1800,
      distance: 20.8,
      elevGain: 1400,
      elevLoss: 1400,
      eventId: event.id,
    },
  })

  const race10 = await db.race.create({
    data: {
      name: "10 km",
      color: "#F472B6",
      startTime: 3600,
      distance: 10.5,
      elevGain: 700,
      elevLoss: 700,
      eventId: event.id,
    },
  })

  console.log(`Created races: ${race50.name}, ${race20.name}, ${race10.name}`)

  // 5. Create simulation
  const simulation = await db.simulation.create({
    data: {
      name: "Simulation 1",
      status: "DONE",
      totalRunners: 300,
      temperature: 18,
      eventId: event.id,
    },
  })

  console.log(`Created simulation: ${simulation.name}`)

  // 6. Create 5 RunnerProfiles matching DEFAULT_PROFILES
  const profiles = [
    {
      label: "Élite",
      percentage: 5,
      baseSpeedMin: 13,
      baseSpeedMax: 18,
      climbCoeff: 1.4,
      descentCoeff: 1.3,
      fatigueFactor: 0.92,
      techSkill: 0.95,
      ravitoDuration: 30,
      abandonRate: 0.01,
      color: "#EF4444",
      simulationId: simulation.id,
    },
    {
      label: "Confirmé",
      percentage: 20,
      baseSpeedMin: 10,
      baseSpeedMax: 13,
      climbCoeff: 1.2,
      descentCoeff: 1.2,
      fatigueFactor: 0.85,
      techSkill: 0.8,
      ravitoDuration: 60,
      abandonRate: 0.04,
      color: "#F97316",
      simulationId: simulation.id,
    },
    {
      label: "Intermédiaire",
      percentage: 45,
      baseSpeedMin: 7,
      baseSpeedMax: 10,
      climbCoeff: 1.0,
      descentCoeff: 1.0,
      fatigueFactor: 0.75,
      techSkill: 0.65,
      ravitoDuration: 90,
      abandonRate: 0.08,
      color: "#7CB518",
      simulationId: simulation.id,
    },
    {
      label: "Amateur",
      percentage: 25,
      baseSpeedMin: 5,
      baseSpeedMax: 7,
      climbCoeff: 0.85,
      descentCoeff: 0.85,
      fatigueFactor: 0.65,
      techSkill: 0.5,
      ravitoDuration: 120,
      abandonRate: 0.14,
      color: "#38BDF8",
      simulationId: simulation.id,
    },
    {
      label: "Marcheur",
      percentage: 5,
      baseSpeedMin: 3,
      baseSpeedMax: 5,
      climbCoeff: 0.7,
      descentCoeff: 0.7,
      fatigueFactor: 0.55,
      techSkill: 0.3,
      ravitoDuration: 180,
      abandonRate: 0.2,
      color: "#A78BFA",
      simulationId: simulation.id,
    },
  ]

  for (const profile of profiles) {
    await db.runnerProfile.create({ data: profile })
  }

  console.log(`Created ${profiles.length} runner profiles`)
  console.log("Seed complete.")

  await db.$disconnect()
}

async function main() {
  await seed()
}
main().catch(console.error).finally(() => db.$disconnect())
