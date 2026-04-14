const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// --- 1. SEED DATABASE ENDPOINT ---
// Allows you to initialize 50 seats on first run
app.post('/api/init-desks', async (req, res) => {
  try {
    const seatCount = await prisma.seat.count();
    if (seatCount > 0) {
      return res.status(400).json({ error: "Seats already initialized" });
    }

    const seatsToCreate = Array.from({ length: 50 }, (_, i) => ({
      deskId: i + 1,
      isFloater: i >= 40 // the last 10 are floater seats
    }));

    await prisma.seat.createMany({ data: seatsToCreate });
    res.json({ message: "50 Seats successfully initialized" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 2. GET ACTIVE BOOKINGS ---
app.get('/api/bookings', async (req, res) => {
  const { week, day } = req.query;
  
  if (!week || !day) return res.status(400).json({ error: "week and day query parameters required" });

  try {
    const bookings = await prisma.booking.findMany({
      where: { week, day },
      include: { seat: true }
    });
    
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 3. CREATE BOOKING ---
app.post('/api/bookings', async (req, res) => {
  const { deskId, userBatch, week, day } = req.body;
  
  try {
    // Attempting to create booking. If @@unique constraint is violated, Prisma throws an error automatically preventing double-booking!
    const newBooking = await prisma.booking.create({
      data: { seatId: deskId, userBatch, week, day }
    });
    
    res.status(201).json(newBooking);
  } catch (error) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: "This seat has already been booked for today." });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// --- 4. CANCEL BOOKING ---
app.delete('/api/bookings', async (req, res) => {
  const { deskId, week, day, userBatch } = req.body;
  
  try {
    const deleted = await prisma.booking.deleteMany({
      where: { seatId: deskId, week, day, userBatch }
    });
    
    if (deleted.count > 0) {
      res.json({ message: "Booking cancelled successfully" });
    } else {
      res.status(404).json({ error: "No matching booking found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 5. RESET ALL BOOKINGS FOR A DAY ---
app.delete('/api/bookings/reset', async (req, res) => {
  const { week, day } = req.body;
  
  try {
    const deleted = await prisma.booking.deleteMany({
      where: { week, day }
    });
    res.json({ message: `Successfully reset ${deleted.count} bookings for ${day} (${week})` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Seat Booking DB API running on http://localhost:${PORT}`));
