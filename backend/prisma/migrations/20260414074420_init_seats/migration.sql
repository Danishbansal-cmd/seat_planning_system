-- CreateTable
CREATE TABLE "Seat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deskId" INTEGER NOT NULL,
    "isFloater" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seatId" INTEGER NOT NULL,
    "userBatch" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat" ("deskId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Seat_deskId_key" ON "Seat"("deskId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_seatId_week_day_key" ON "Booking"("seatId", "week", "day");
