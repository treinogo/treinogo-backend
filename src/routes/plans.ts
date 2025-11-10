import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = express.Router();

// Get all training plans
router.get('/', authenticate, async (req: any, res) => {
  try {
    const { category, status } = req.query;

    const whereClause: any = {};

    if (category) {
      whereClause.category = category;
    }

    if (status) {
      whereClause.status = status;
    }

    const plans = await prisma.trainingPlan.findMany({
      where: whereClause,
      include: {
        createdBy: {
          include: {
            user: {
              select: { name: true }
            }
          }
        },
        _count: {
          select: {
            athletes: true,
            trainings: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create training plan (coaches only)
router.post('/', authenticate, authorizeRole(['COACH', 'ADMIN']), async (req: any, res) => {
  try {
    const { name, category, duration, daysPerWeek } = req.body;

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!coachProfile) {
      return res.status(404).json({ error: 'Coach profile not found' });
    }

    const plan = await prisma.trainingPlan.create({
      data: {
        name,
        category,
        duration,
        daysPerWeek,
        createdById: coachProfile.id
      }
    });

    res.status(201).json({ message: 'Training plan created successfully', plan });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get plan details
router.get('/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;

    const plan = await prisma.trainingPlan.findUnique({
      where: { id },
      include: {
        createdBy: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        trainings: {
          orderBy: { date: 'asc' }
        },
        athletes: {
          include: {
            user: {
              select: { name: true, email: true, avatar: true }
            }
          }
        }
      }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({ plan });
  } catch (error) {
    console.error('Get plan details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign plan to athlete
router.post('/:id/assign', authenticate, authorizeRole(['COACH', 'ADMIN']), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { athleteId } = req.body;

    const plan = await prisma.trainingPlan.findUnique({
      where: { id }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteId }
    });

    if (!athlete) {
      return res.status(404).json({ error: 'Athlete not found' });
    }

    await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: {
        currentPlanId: id
      }
    });

    res.json({ message: 'Plan assigned successfully' });
  } catch (error) {
    console.error('Assign plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get weekly programming for a plan
router.get('/:id/weekly-programming', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;

    const plan = await prisma.trainingPlan.findUnique({
      where: { id },
      include: {
        weeklyProgramming: {
          orderBy: { week: 'asc' }
        }
      }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({ weeklyProgramming: plan.weeklyProgramming });
  } catch (error) {
    console.error('Get weekly programming error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update weekly programming for a plan
router.put('/:id/weekly-programming/:week', authenticate, authorizeRole(['COACH', 'ADMIN']), async (req: any, res) => {
  try {
    const { id, week } = req.params;
    const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body;

    const plan = await prisma.trainingPlan.findUnique({
      where: { id }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Check if coach owns this plan
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!coachProfile || plan.createdById !== coachProfile.id) {
      return res.status(403).json({ error: 'Access denied. You can only modify your own plans.' });
    }

    const weekNumber = parseInt(week);

    // Upsert weekly programming
    const weeklyProgramming = await prisma.weeklyProgramming.upsert({
      where: {
        planId_week: {
          planId: id,
          week: weekNumber
        }
      },
      update: {
        monday: monday ? JSON.stringify(monday) : null,
        tuesday: tuesday ? JSON.stringify(tuesday) : null,
        wednesday: wednesday ? JSON.stringify(wednesday) : null,
        thursday: thursday ? JSON.stringify(thursday) : null,
        friday: friday ? JSON.stringify(friday) : null,
        saturday: saturday ? JSON.stringify(saturday) : null,
        sunday: sunday ? JSON.stringify(sunday) : null
      },
      create: {
        planId: id,
        week: weekNumber,
        monday: monday ? JSON.stringify(monday) : null,
        tuesday: tuesday ? JSON.stringify(tuesday) : null,
        wednesday: wednesday ? JSON.stringify(wednesday) : null,
        thursday: thursday ? JSON.stringify(thursday) : null,
        friday: friday ? JSON.stringify(friday) : null,
        saturday: saturday ? JSON.stringify(saturday) : null,
        sunday: sunday ? JSON.stringify(sunday) : null
      }
    });

    res.json({ message: 'Weekly programming updated successfully', weeklyProgramming });
  } catch (error) {
    console.error('Update weekly programming error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign multiple athletes to a plan
router.post('/:id/assign-multiple', authenticate, authorizeRole(['COACH', 'ADMIN']), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { athleteIds } = req.body;

    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return res.status(400).json({ error: 'athleteIds must be a non-empty array' });
    }

    const plan = await prisma.trainingPlan.findUnique({
      where: { id }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Check if coach owns this plan and athletes
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId },
      include: {
        athletes: {
          where: { id: { in: athleteIds } }
        }
      }
    });

    if (!coachProfile || plan.createdById !== coachProfile.id) {
      return res.status(403).json({ error: 'Access denied. You can only modify your own plans.' });
    }

    if (coachProfile.athletes.length !== athleteIds.length) {
      return res.status(400).json({ error: 'Some athletes do not belong to your coaching' });
    }

    // Update all athletes
    await prisma.athleteProfile.updateMany({
      where: { id: { in: athleteIds } },
      data: { currentPlanId: id }
    });

    res.json({ message: 'Plan assigned to multiple athletes successfully' });
  } catch (error) {
    console.error('Assign plan to multiple athletes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get plans created by the coach
router.get('/coach/my-plans', authenticate, authorizeRole(['COACH']), async (req: any, res) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!coachProfile) {
      return res.status(404).json({ error: 'Coach profile not found' });
    }

    const plans = await prisma.trainingPlan.findMany({
      where: { createdById: coachProfile.id },
      include: {
        _count: {
          select: {
            athletes: true,
            trainings: true,
            weeklyProgramming: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ plans });
  } catch (error) {
    console.error('Get coach plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;