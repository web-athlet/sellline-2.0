-- Session 7: M7 Activities — Add bookingSlug to User and BookingConfig model

ALTER TABLE "User" ADD COLUMN "bookingSlug" TEXT;
CREATE UNIQUE INDEX "User_bookingSlug_key" ON "User"("bookingSlug");

CREATE TABLE "BookingConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "workdayStart" INTEGER NOT NULL DEFAULT 9,
    "workdayEnd" INTEGER NOT NULL DEFAULT 17,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "activeDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingConfig_userId_key" ON "BookingConfig"("userId");

ALTER TABLE "BookingConfig" ADD CONSTRAINT "BookingConfig_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
