import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get trainings for athlete
router.get('/', authenticate, async (req: any, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!athleteProfile) {
      return res.status(404).json({ error: 'Athlete profile not found' });
    }

    const whereClause: any = {
      athleteId: athleteProfile.id
    };

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    if (status) {
      whereClause.status = status;
    }

    const trainings = await prisma.training.findMany({
      where: whereClause,
      include: {
        plan: {
          select: { name: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    res.json({ trainings });
  } catch (error) {
    console.error('Get trainings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create training
router.post('/', authenticate, async (req: any, res) => {
  try {
    const { date, type, distance, duration, pace, notes, planId } = req.body;

    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!athleteProfile) {
      return res.status(404).json({ error: 'Athlete profile not found' });
    }

    const training = await prisma.training.create({
      data: {
        date: new Date(date),
        type,
        distance,
        duration,
        pace,
        notes,
        athleteId: athleteProfile.id,
        planId: planId || null
      }
    });

    res.status(201).json({ message: 'Training created successfully', training });
  } catch (error) {
    console.error('Create training error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update training status
router.patch('/:id/status', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const training = await prisma.training.findUnique({
      where: { id },
      include: { athlete: true }
    });

    if (!training) {
      return res.status(404).json({ error: 'Training not found' });
    }

    if (training.athlete.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedTraining = await prisma.training.update({
      where: { id },
      data: { status }
    });

    // Update athlete's completed trainings count if status is COMPLETED
    if (status === 'COMPLETED') {
      await prisma.athleteProfile.update({
        where: { id: training.athleteId },
        data: {
          completedTrainings: {
            increment: 1
          }
        }
      });
    }

    res.json({ message: 'Training status updated', training: updatedTraining });
  } catch (error) {
    console.error('Update training status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get training details
router.get('/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;

    const training = await prisma.training.findUnique({
      where: { id },
      include: {
        athlete: {
          include: {
            user: {
              select: { name: true }
            }
          }
        },
        plan: {
          select: { name: true }
        }
      }
    });

    if (!training) {
      return res.status(404).json({ error: 'Training not found' });
    }

    // Check if user has access to this training
    if (training.athlete.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ training });
  } catch (error) {
    console.error('Get training details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;