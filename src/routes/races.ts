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

// GET /api/races/:id/registrations - Get race registrations
router.get('/:id/registrations', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
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

    const registrations = await prisma.raceRegistration.findMany({
      where: { raceId: id },
      include: {
        athlete: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ registrations });
  } catch (error) {
    console.error('Get race registrations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/races/:id/registrations - Register athletes to race
router.post('/:id/registrations', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { athleteIds, distance } = req.body;

    if (!athleteIds || !Array.isArray(athleteIds) || athleteIds.length === 0) {
      return res.status(400).json({ error: 'athleteIds array is required' });
    }

    if (!distance) {
      return res.status(400).json({ error: 'distance is required' });
    }

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

    if (!race.distances.includes(distance)) {
      return res.status(400).json({ error: 'Distance not available for this race' });
    }

    // Verify athletes belong to coach
    const athletes = await prisma.athleteProfile.findMany({
      where: {
        id: { in: athleteIds },
        coachId: coach.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (athletes.length !== athleteIds.length) {
      return res.status(403).json({ error: 'Some athletes do not belong to this coach' });
    }

    // Create registrations (skip duplicates for same distance)
    const registrations = [];
    const skipped: string[] = [];
    
    for (const athleteId of athleteIds) {
      // Get all registrations for this athlete in this race (single query)
      const allRegistrations = await prisma.raceRegistration.findMany({
        where: {
          raceId: id,
          athleteId
        }
      });
      
      console.log(`🔍 All registrations for athlete ${athleteId} in race ${id}:`, allRegistrations.map(r => ({ id: r.id, distance: r.distance, raceId: r.raceId, athleteId: r.athleteId })));
      
      // Find exact match for this distance (manual check to be 100% sure)
      const existing = allRegistrations.find(
        reg => reg.distance === distance
      );

      console.log(`🔍 Checking athlete ${athleteId} for race ${id} distance "${distance}":`, existing ? `✅ ALREADY EXISTS (id: ${existing.id}, distance: "${existing.distance}")` : '❌ NOT FOUND');
      
      if (existing) {
        // Verify the distance matches exactly
        if (existing.distance === distance) {
          // Already registered for this distance
          const athlete = athletes.find(a => a.id === athleteId);
          if (athlete && athlete.user) {
            skipped.push(athlete.user.name || 'Aluno');
          }
          continue;
        } else {
          console.error(`⚠️ DISTANCE MISMATCH: Existing distance "${existing.distance}" !== requested "${distance}"`);
          // Don't skip if distances don't match exactly
        }
      }

      try {
        const registration = await prisma.raceRegistration.create({
          data: {
            raceId: id,
            athleteId,
            distance
          },
          include: {
            athlete: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatar: true
                  }
                }
              }
            }
          }
        });
        registrations.push(registration);
      } catch (error: any) {
        // Skip if already registered (unique constraint)
        if (error.code === 'P2002') {
          const athlete = athletes.find(a => a.id === athleteId);
          if (athlete && athlete.user) {
            skipped.push(athlete.user.name || 'Aluno');
          }
        } else {
          throw error;
        }
      }
    }

    // Return info about skipped registrations
    res.status(201).json({ 
      registrations,
      skipped: skipped.length > 0 ? skipped : undefined
    });
  } catch (error) {
    console.error('Create race registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/races/:id/registrations/:registrationId - Remove race registration
router.delete('/:id/registrations/:registrationId', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id, registrationId } = req.params;

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

    const registration = await prisma.raceRegistration.findFirst({
      where: {
        id: registrationId,
        raceId: id
      },
      include: {
        athlete: {
          select: {
            coachId: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (registration.athlete.coachId !== coach.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.raceRegistration.delete({
      where: { id: registrationId }
    });

    res.json({ message: 'Registration removed successfully' });
  } catch (error) {
    console.error('Delete race registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// ATHLETE ENDPOINTS
// ============================================

// GET /api/races/athlete/all - List all races for athlete
router.get('/athlete/all', authenticate, authorizeRole(['ATHLETE']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId }
    });

    if (!athlete) {
      return res.status(403).json({ error: 'Access denied. Athlete profile required.' });
    }

    // Get all races created by athlete's coach
    const races = await prisma.race.findMany({
      where: {
        createdById: athlete.coachId || undefined
      },
      include: {
        registrations: {
          where: {
            athleteId: athlete.id
          },
          select: {
            id: true,
            distance: true,
            createdAt: true
          }
        }
      },
      orderBy: { raceDate: 'asc' }
    });

    res.json({ races });
  } catch (error) {
    console.error('List races for athlete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/races/:id/athlete/register - Athlete self-register for race
router.post('/:id/athlete/register', authenticate, authorizeRole(['ATHLETE']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { distance } = req.body;

    if (!distance) {
      return res.status(400).json({ error: 'distance is required' });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId }
    });

    if (!athlete) {
      return res.status(403).json({ error: 'Access denied. Athlete profile required.' });
    }

    const race = await prisma.race.findUnique({
      where: { id }
    });

    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }

    if (!race.distances.includes(distance)) {
      return res.status(400).json({ error: 'Distance not available for this race' });
    }

    // Check if already registered for this distance
    const existing = await prisma.raceRegistration.findUnique({
      where: {
        raceId_athleteId_distance: {
          raceId: id,
          athleteId: athlete.id,
          distance
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Already registered for this distance' });
    }

    const registration = await prisma.raceRegistration.create({
      data: {
        raceId: id,
        athleteId: athlete.id,
        distance
      }
    });

    res.status(201).json({ registration });
  } catch (error) {
    console.error('Athlete register for race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/races/:id/athlete/unregister - Athlete self-unregister from race
router.delete('/:id/athlete/unregister', authenticate, authorizeRole(['ATHLETE']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { distance } = req.body;

    if (!distance) {
      return res.status(400).json({ error: 'distance is required' });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId }
    });

    if (!athlete) {
      return res.status(403).json({ error: 'Access denied. Athlete profile required.' });
    }

    const registration = await prisma.raceRegistration.findUnique({
      where: {
        raceId_athleteId_distance: {
          raceId: id,
          athleteId: athlete.id,
          distance
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    await prisma.raceRegistration.delete({
      where: { id: registration.id }
    });

    res.json({ message: 'Unregistered successfully' });
  } catch (error) {
    console.error('Athlete unregister from race error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;