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

export default router;