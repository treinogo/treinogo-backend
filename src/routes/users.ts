import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get user profile
router.get('/me', authenticate, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        athleteProfile: {
          include: {
            currentPlan: true,
            coach: {
              include: {
                user: {
                  select: { name: true, email: true }
                }
              }
            }
          }
        },
        coachProfile: {
          include: {
            athletes: {
              include: {
                user: {
                  select: { name: true, email: true, avatar: true }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/me', authenticate, async (req: any, res) => {
  try {
    const { name, phone, age, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        name,
        phone,
        age,
        avatar
      }
    });

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get athletes (for coaches)
router.get('/athletes', authenticate, async (req: any, res) => {
  try {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: req.userId },
      include: {
        athletes: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, phone: true, age: true }
            },
            currentPlan: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!coach) {
      return res.status(404).json({ error: 'Coach profile not found' });
    }

    res.json({ athletes: coach.athletes });
  } catch (error) {
    console.error('Get athletes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;