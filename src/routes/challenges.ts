import express from 'express';
import { PrismaClient, ChallengeStatus } from '@prisma/client';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

interface AuthRequest extends express.Request {
  userId?: string;
  userRole?: string;
}

// GET /api/challenges - List challenges for coach
router.get('/', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const challenges = await prisma.challenge.findMany({
      where: { createdById: coach.id },
      include: {
        participants: {
          include: {
            athlete: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true }
                }
              }
            }
          }
        },
        _count: {
          select: { participants: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ challenges });
  } catch (error) {
    console.error('List challenges error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/challenges - Create new challenge
router.post('/', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { name, objective, duration, startDate, endDate, reward, participantIds } = req.body;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const challenge = await prisma.challenge.create({
      data: {
        name,
        objective,
        duration,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reward,
        createdById: coach.id,
        participants: {
          create: participantIds?.map((athleteId: string) => ({
            athleteId,
            progress: 0,
            points: 0
          })) || []
        }
      },
      include: {
        participants: {
          include: {
            athlete: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true }
                }
              }
            }
          }
        }
      }
    });

    res.status(201).json({ challenge });
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/challenges/:id - Get specific challenge
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

    const challenge = await prisma.challenge.findFirst({
      where: { 
        id,
        createdById: coach.id 
      },
      include: {
        participants: {
          include: {
            athlete: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true }
                }
              }
            }
          },
          orderBy: { points: 'desc' }
        }
      }
    });

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    res.json({ challenge });
  } catch (error) {
    console.error('Get challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/challenges/:id - Update challenge
router.put('/:id', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { name, objective, duration, startDate, endDate, reward, status } = req.body;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const existingChallenge = await prisma.challenge.findFirst({
      where: { 
        id,
        createdById: coach.id 
      }
    });

    if (!existingChallenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const challenge = await prisma.challenge.update({
      where: { id },
      data: {
        name,
        objective,
        duration,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        reward,
        status: status as ChallengeStatus
      },
      include: {
        participants: {
          include: {
            athlete: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true }
                }
              }
            }
          }
        }
      }
    });

    res.json({ challenge });
  } catch (error) {
    console.error('Update challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/challenges/:id - Delete challenge
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

    const existingChallenge = await prisma.challenge.findFirst({
      where: { 
        id,
        createdById: coach.id 
      }
    });

    if (!existingChallenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    await prisma.challenge.delete({
      where: { id }
    });

    res.json({ message: 'Challenge deleted successfully' });
  } catch (error) {
    console.error('Delete challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/challenges/:id/participants - Add participant to challenge
router.post('/:id/participants', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { athleteId } = req.body;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const challenge = await prisma.challenge.findFirst({
      where: { 
        id,
        createdById: coach.id 
      }
    });

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const athlete = await prisma.athleteProfile.findFirst({
      where: { 
        id: athleteId,
        coachId: coach.id 
      }
    });

    if (!athlete) {
      return res.status(404).json({ error: 'Athlete not found or not under your coaching' });
    }

    const participant = await prisma.challengeParticipant.create({
      data: {
        challengeId: id,
        athleteId,
        progress: 0,
        points: 0
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

    res.status(201).json({ participant });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/challenges/:id/participants/:participantId - Update participant progress
router.put('/:id/participants/:participantId', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { id, participantId } = req.params;
    const { progress, points } = req.body;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const challenge = await prisma.challenge.findFirst({
      where: { 
        id,
        createdById: coach.id 
      }
    });

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const participant = await prisma.challengeParticipant.update({
      where: { id: participantId },
      data: {
        progress: progress ?? undefined,
        points: points ?? undefined
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

    res.json({ participant });
  } catch (error) {
    console.error('Update participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;