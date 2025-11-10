import express from 'express';
import { PrismaClient, TimeOfDay } from '@prisma/client';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

interface AuthRequest extends express.Request {
  userId?: string;
  userRole?: string;
}

// GET /api/races - List races for coach
router.get('/', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { month, year, city, state } = req.query;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    // Build filters
    const whereClause: any = {
      createdById: coach.id
    };

    if (month || year) {
      whereClause.raceDate = {};
      
      if (year) {
        const startOfYear = new Date(`${year}-01-01`);
        const endOfYear = new Date(`${year}-12-31`);
        whereClause.raceDate.gte = startOfYear;
        whereClause.raceDate.lte = endOfYear;
      }

      if (month && year) {
        const startOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01`);
        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);
        
        whereClause.raceDate.gte = startOfMonth;
        whereClause.raceDate.lte = endOfMonth;
      }
    }

    if (city) {
      whereClause.city = {
        contains: city as string,
        mode: 'insensitive'
      };
    }

    if (state) {
      whereClause.state = {
        contains: state as string,
        mode: 'insensitive'
      };
    }

    const races = await prisma.race.findMany({
      where: whereClause,
      orderBy: { raceDate: 'asc' }
    });

    res.json({ races });
  } catch (error) {
    console.error('List races error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/races - Create new race
router.post('/', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { name, distances, city, state, raceDate, timeOfDay, link } = req.body;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const race = await prisma.race.create({
      data: {
        name,
        distances: distances || [],
        city,
        state,
        raceDate: new Date(raceDate),
        timeOfDay: timeOfDay as TimeOfDay,
        link,
        createdById: coach.id
      }
    });

    res.status(201).json({ race });
  } catch (error) {
    console.error('Create race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/races/:id - Get specific race
router.get('/:id', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const race = await prisma.race.findFirst({
      where: { 
        id,
        createdById: coach.id 
      }
    });

    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }

    res.json({ race });
  } catch (error) {
    console.error('Get race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/races/:id - Update race
router.put('/:id', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { name, distances, city, state, raceDate, timeOfDay, link } = req.body;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    // Check if race exists and belongs to coach
    const existingRace = await prisma.race.findFirst({
      where: { 
        id,
        createdById: coach.id 
      }
    });

    if (!existingRace) {
      return res.status(404).json({ error: 'Race not found' });
    }

    const race = await prisma.race.update({
      where: { id },
      data: {
        name,
        distances: distances || undefined,
        city,
        state,
        raceDate: raceDate ? new Date(raceDate) : undefined,
        timeOfDay: timeOfDay as TimeOfDay,
        link
      }
    });

    res.json({ race });
  } catch (error) {
    console.error('Update race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/races/:id - Delete race
router.delete('/:id', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    // Check if race exists and belongs to coach
    const existingRace = await prisma.race.findFirst({
      where: { 
        id,
        createdById: coach.id 
      }
    });

    if (!existingRace) {
      return res.status(404).json({ error: 'Race not found' });
    }

    await prisma.race.delete({
      where: { id }
    });

    res.json({ message: 'Race deleted successfully' });
  } catch (error) {
    console.error('Delete race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/races/upcoming/:months - Get upcoming races in next X months
router.get('/upcoming/:months', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { months } = req.params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(now.getMonth() + parseInt(months));

    const races = await prisma.race.findMany({
      where: {
        createdById: coach.id,
        raceDate: {
          gte: now,
          lte: futureDate
        }
      },
      orderBy: { raceDate: 'asc' }
    });

    res.json({ races });
  } catch (error) {
    console.error('Get upcoming races error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/races/search - Search races by name, city or state
router.get('/search', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const races = await prisma.race.findMany({
      where: {
        createdById: coach.id,
        OR: [
          {
            name: {
              contains: q as string,
              mode: 'insensitive'
            }
          },
          {
            city: {
              contains: q as string,
              mode: 'insensitive'
            }
          },
          {
            state: {
              contains: q as string,
              mode: 'insensitive'
            }
          }
        ]
      },
      orderBy: { raceDate: 'asc' }
    });

    res.json({ races });
  } catch (error) {
    console.error('Search races error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/races/by-distance/:distance - Get races by specific distance
router.get('/by-distance/:distance', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { distance } = req.params;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const races = await prisma.race.findMany({
      where: {
        createdById: coach.id,
        distances: {
          has: distance
        }
      },
      orderBy: { raceDate: 'asc' }
    });

    res.json({ races });
  } catch (error) {
    console.error('Get races by distance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;