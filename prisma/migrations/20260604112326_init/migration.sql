-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "date" DATETIME,
    "location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "distance" REAL NOT NULL DEFAULT 0,
    "elevGain" INTEGER NOT NULL DEFAULT 0,
    "elevLoss" INTEGER NOT NULL DEFAULT 0,
    "startTime" INTEGER NOT NULL DEFAULT 0,
    "gpxRaw" TEXT,
    "gpxPoints" TEXT NOT NULL DEFAULT '[]',
    "color" TEXT NOT NULL DEFAULT '#7CB518',
    "eventId" TEXT NOT NULL,
    CONSTRAINT "Race_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raceId" TEXT NOT NULL,
    "indexStart" INTEGER NOT NULL DEFAULT 0,
    "indexEnd" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'NARROW',
    "label" TEXT,
    "width" REAL NOT NULL DEFAULT 1.0,
    "techLevel" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "lat" REAL NOT NULL DEFAULT 0,
    "lng" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Segment_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" TEXT NOT NULL,
    "totalRunners" INTEGER NOT NULL DEFAULT 300,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "temperature" REAL NOT NULL DEFAULT 18.0,
    "wind" REAL NOT NULL DEFAULT 0.0,
    "windDirection" REAL NOT NULL DEFAULT 0.0,
    "rain" BOOLEAN NOT NULL DEFAULT false,
    "rainIntensity" REAL NOT NULL DEFAULT 0.0,
    "fog" BOOLEAN NOT NULL DEFAULT false,
    "resultSnapshot" TEXT,
    "riskMap" TEXT,
    "logistique" TEXT NOT NULL DEFAULT '[]',
    "ressources" TEXT NOT NULL DEFAULT '{"effectifTotal":45,"barrieres":20}',
    CONSTRAINT "Simulation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunnerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "percentage" REAL NOT NULL,
    "baseSpeedMin" REAL NOT NULL DEFAULT 7,
    "baseSpeedMax" REAL NOT NULL DEFAULT 10,
    "climbCoeff" REAL NOT NULL DEFAULT 1.0,
    "descentCoeff" REAL NOT NULL DEFAULT 1.0,
    "fatigueFactor" REAL NOT NULL DEFAULT 0.8,
    "techSkill" REAL NOT NULL DEFAULT 0.7,
    "ravitoDuration" INTEGER NOT NULL DEFAULT 90,
    "abandonRate" REAL NOT NULL DEFAULT 0.1,
    "color" TEXT NOT NULL DEFAULT '#888780',
    "simulationId" TEXT NOT NULL,
    CONSTRAINT "RunnerProfile_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
