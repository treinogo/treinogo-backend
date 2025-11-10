import express from 'express';
import { PrismaClient, PhysicalTestType } from '@prisma/client';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

interface AuthRequest extends express.Request {
  userId?: string;
  userRole?: string;
}

// GET /api/physical-tests - List physical tests for coach
router.get('/', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      include: {
        athletes: {
          include: {
            physicalTests: {
              include: {
                athlete: {
                  include: {
                    user: {
                      select: { id: true, name: true, avatar: true }
                    }
                  }
                }
              },
              orderBy: { testDate: 'desc' }
            }
          }
        }
      }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    // Flatten the tests from all athletes
    const allTests = coach.athletes.flatMap(athlete => athlete.physicalTests);
    
    res.json({ tests: allTests });
  } catch (error) {
    console.error('List physical tests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/physical-tests/athlete/:athleteId - List tests for specific athlete
router.get('/athlete/:athleteId', authenticate, authorizeRole(['COACH', 'ATHLETE']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { athleteId } = req.params;

    let allowedAthletes: string[] = [];

    if (req.userRole === 'COACH') {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId },
        include: {
          athletes: {
            select: { id: true }
          }
        }
      });

      if (!coach) {
        return res.status(403).json({ error: 'Access denied. Coach profile required.' });
      }

      allowedAthletes = coach.athletes.map(a => a.id);
    } else {
      // For athletes, they can only see their own tests
      const athlete = await prisma.athleteProfile.findUnique({
        where: { userId }
      });

      if (!athlete) {
        return res.status(403).json({ error: 'Access denied. Athlete profile required.' });
      }

      allowedAthletes = [athlete.id];
    }

    if (!allowedAthletes.includes(athleteId)) {
      return res.status(403).json({ error: 'Access denied to this athlete data.' });
    }

    const tests = await prisma.physicalTest.findMany({
      where: { athleteId },
      include: {
        athlete: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      },
      orderBy: { testDate: 'desc' }
    });

    res.json({ tests });
  } catch (error) {
    console.error('List athlete physical tests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/physical-tests - Create new physical test
router.post('/', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { athleteId, testType, pace, finalTime, distance, testDate } = req.body;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    // Check if athlete belongs to this coach
    const athlete = await prisma.athleteProfile.findFirst({
      where: { 
        id: athleteId,
        coachId: coach.id 
      }
    });

    if (!athlete) {
      return res.status(404).json({ error: 'Athlete not found or not under your coaching' });
    }

    const test = await prisma.physicalTest.create({
      data: {
        athleteId,
        testType: testType as PhysicalTestType,
        pace,
        finalTime,
        distance: distance ? parseFloat(distance) : null,
        testDate: new Date(testDate)
      },
      include: {
        athlete: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      }
    });

    res.status(201).json({ test });
  } catch (error) {
    console.error('Create physical test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/physical-tests/:id - Get specific test
router.get('/:id', authenticate, authorizeRole(['COACH', 'ATHLETE']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const test = await prisma.physicalTest.findUnique({
      where: { id },
      include: {
        athlete: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            },
            coach: {
              include: {
                user: {
                  select: { id: true }
                }
              }
            }
          }
        }
      }
    });

    if (!test) {
      return res.status(404).json({ error: 'Physical test not found' });
    }

    // Check permissions
    let hasAccess = false;

    if (req.userRole === 'COACH') {
      hasAccess = test.athlete.coach?.user.id === userId;
    } else if (req.userRole === 'ATHLETE') {
      hasAccess = test.athlete.user.id === userId;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this test data.' });
    }

    res.json({ test });
  } catch (error) {
    console.error('Get physical test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/physical-tests/:id - Update physical test
router.put('/:id', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { testType, pace, finalTime, distance, testDate } = req.body;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    // Check if test exists and belongs to coach's athlete
    const existingTest = await prisma.physicalTest.findFirst({
      where: { 
        id,
        athlete: {
          coachId: coach.id
        }
      }
    });

    if (!existingTest) {
      return res.status(404).json({ error: 'Physical test not found or access denied' });
    }

    const test = await prisma.physicalTest.update({
      where: { id },
      data: {
        testType: testType as PhysicalTestType,
        pace,
        finalTime,
        distance: distance ? parseFloat(distance) : undefined,
        testDate: testDate ? new Date(testDate) : undefined
      },
      include: {
        athlete: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      }
    });

    res.json({ test });
  } catch (error) {
    console.error('Update physical test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/physical-tests/:id - Delete physical test
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

    // Check if test exists and belongs to coach's athlete
    const existingTest = await prisma.physicalTest.findFirst({
      where: { 
        id,
        athlete: {
          coachId: coach.id
        }
      }
    });

    if (!existingTest) {
      return res.status(404).json({ error: 'Physical test not found or access denied' });
    }

    await prisma.physicalTest.delete({
      where: { id }
    });

    res.json({ message: 'Physical test deleted successfully' });
  } catch (error) {
    console.error('Delete physical test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/physical-tests/stats/:athleteId - Get test statistics for athlete
router.get('/stats/:athleteId', authenticate, authorizeRole(['COACH', 'ATHLETE']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { athleteId } = req.params;

    let hasAccess = false;

    if (req.userRole === 'COACH') {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId },
        include: {
          athletes: {
            select: { id: true }
          }
        }
      });

      if (!coach) {
        return res.status(403).json({ error: 'Access denied. Coach profile required.' });
      }

      hasAccess = coach.athletes.some(a => a.id === athleteId);
    } else {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { userId }
      });

      hasAccess = athlete?.id === athleteId;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this athlete data.' });
    }

    const tests = await prisma.physicalTest.findMany({
      where: { athleteId },
      orderBy: { testDate: 'asc' }
    });

    // Group by test type and calculate progression
    const statsByType: Record<string, any> = {};

    tests.forEach(test => {
      if (!statsByType[test.testType]) {
        statsByType[test.testType] = {
          testType: test.testType,
          count: 0,
          tests: [],
          improvement: null
        };
      }

      statsByType[test.testType].count++;
      statsByType[test.testType].tests.push(test);
    });

    // Calculate improvement for each test type
    Object.keys(statsByType).forEach(testType => {
      const typeTests = statsByType[testType].tests;
      if (typeTests.length >= 2) {
        const first = typeTests[0];
        const last = typeTests[typeTests.length - 1];
        
        // For distance tests (12 minutes), improvement is positive for more distance
        if (testType === 'TWELVE_MINUTES' && first.distance && last.distance) {
          const improvement = ((last.distance - first.distance) / first.distance) * 100;
          statsByType[testType].improvement = improvement;
        }
        // For time tests, improvement is negative for less time (faster)
        else if ((testType === 'THREE_KM' || testType === 'FIVE_KM')) {
          // Convert pace to seconds for comparison
          const firstSeconds = parseFloat(first.finalTime) || 0;
          const lastSeconds = parseFloat(last.finalTime) || 0;
          
          if (firstSeconds > 0 && lastSeconds > 0) {
            const improvement = ((firstSeconds - lastSeconds) / firstSeconds) * 100;
            statsByType[testType].improvement = improvement;
          }
        }
      }
    });

    res.json({ stats: Object.values(statsByType) });
  } catch (error) {
    console.error('Get physical test stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;