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
              select: { id: true, name: true, email: true, avatar: true, phone: true, age: true, createdAt: true }
            },
            currentPlan: {
              select: { id: true, name: true, duration: true }
            },
            trainings: {
              select: { 
                id: true, 
                status: true, 
                duration: true, 
                pace: true, 
                date: true,
                planId: true 
              }
            }
          }
        }
      }
    });

    if (!coach) {
      return res.status(404).json({ error: 'Coach profile not found' });
    }

    // Calculate enhanced stats for each athlete
    const athletesWithStats = await Promise.all(
      coach.athletes.map(async (athlete) => {
        // Calculate completed trainings
        const completedTrainings = athlete.trainings.filter(t => t.status === 'COMPLETED').length;
        
        // Calculate current plan progress
        let currentProgress = 0;
        if (athlete.currentPlan) {
          const planTrainings = athlete.trainings.filter(t => t.planId === athlete.currentPlan?.id);
          const completedPlanTrainings = planTrainings.filter(t => t.status === 'COMPLETED').length;
          
          // Estimate total trainings expected for the plan (duration in weeks * average trainings per week)
          const estimatedTotalTrainings = (athlete.currentPlan.duration || 4) * 4; // Assuming 4 trainings per week on average
          currentProgress = estimatedTotalTrainings > 0 
            ? Math.min(Math.round((completedPlanTrainings / estimatedTotalTrainings) * 100), 100)
            : 0;
        }

        // Calculate average time and pace from completed trainings
        const completedTrainingsWithData = athlete.trainings.filter(t => 
          t.status === 'COMPLETED' && t.duration && t.pace
        );

        let averageTime = '-';
        let averagePace = '-';

        if (completedTrainingsWithData.length > 0) {
          // Convert duration strings to minutes for averaging
          const durations = completedTrainingsWithData
            .map(t => {
              const duration = t.duration;
              if (duration.includes(':')) {
                const [hours, minutes] = duration.split(':').map(Number);
                return (hours || 0) * 60 + (minutes || 0);
              }
              // If it's just minutes
              return parseInt(duration.replace(/\D/g, '')) || 0;
            })
            .filter(d => d > 0);

          if (durations.length > 0) {
            const avgMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
            const hours = Math.floor(avgMinutes / 60);
            const minutes = avgMinutes % 60;
            averageTime = hours > 0 ? `${hours}h${minutes.toString().padStart(2, '0')}min` : `${minutes}min`;
          }

          // Calculate average pace (format: "mm:ss")
          const paces = completedTrainingsWithData
            .map(t => {
              const pace = t.pace;
              if (pace.includes(':')) {
                const [minutes, seconds] = pace.split(':').map(Number);
                return minutes * 60 + (seconds || 0); // Convert to total seconds
              }
              return 0;
            })
            .filter(p => p > 0);

          if (paces.length > 0) {
            const avgSeconds = Math.round(paces.reduce((a, b) => a + b, 0) / paces.length);
            const minutes = Math.floor(avgSeconds / 60);
            const seconds = avgSeconds % 60;
            averagePace = `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
          }
        }

        return {
          ...athlete,
          completedTrainings,
          currentProgress,
          averageTime,
          averagePace
        };
      })
    );

    res.json({ athletes: athletesWithStats });
  } catch (error) {
    console.error('Get athletes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update athlete (for coaches)
router.put('/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, age, level, status } = req.body;

    // Verify that the user to be updated is an athlete of this coach
    const userToUpdate = await prisma.user.findUnique({
      where: { id },
      include: {
        athleteProfile: true
      }
    });

    if (!userToUpdate || !userToUpdate.athleteProfile) {
      return res.status(404).json({ error: 'Athlete not found' });
    }

    // Check if the current user is the coach of this athlete
    const currentUserCoach = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!currentUserCoach || userToUpdate.athleteProfile.coachId !== currentUserCoach.id) {
      return res.status(403).json({ error: 'You can only update your own athletes' });
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        age: age ? parseInt(age) : null
      }
    });

    // Update athlete profile if level or status provided
    if (level || status) {
      const updateData: any = {};
      if (level) updateData.level = level;
      if (status) updateData.status = status;

      await prisma.athleteProfile.update({
        where: { userId: id },
        data: updateData
      });
    }

    res.json({ message: 'Athlete updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update athlete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get athlete weekly evolution/progress
router.get('/:athleteId/evolution', authenticate, async (req: any, res) => {
  try {
    const { athleteId } = req.params;
    const { weeks = 6 } = req.query; // Default last 6 weeks

    // Verify that this athlete belongs to the current coach
    const currentUserCoach = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!currentUserCoach) {
      return res.status(403).json({ error: 'Coach profile not found' });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: athleteId },
      include: {
        user: { select: { name: true } }
      }
    });

    if (!athlete || athlete.coachId !== currentUserCoach.id) {
      return res.status(404).json({ error: 'Athlete not found or not your athlete' });
    }

    // Get training data for the last X weeks
    const weeksAgo = new Date();
    weeksAgo.setDate(weeksAgo.getDate() - (parseInt(weeks) * 7));

    const trainings = await prisma.training.findMany({
      where: {
        athleteId: athlete.id,
        status: 'COMPLETED',
        date: {
          gte: weeksAgo
        }
      },
      orderBy: { date: 'asc' }
    });

    // Group trainings by week and calculate metrics
    const weeklyData = [];
    const currentWeekStart = new Date();
    
    for (let i = parseInt(weeks) - 1; i >= 0; i--) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - (i * 7) - (currentWeekStart.getDay() || 7) + 1); // Start of week (Monday)
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // End of week (Sunday)

      const weekTrainings = trainings.filter(training => {
        const trainingDate = new Date(training.date);
        return trainingDate >= weekStart && trainingDate <= weekEnd;
      });

      // Calculate average time in minutes
      let totalMinutes = 0;
      let validTrainings = 0;

      weekTrainings.forEach(training => {
        if (training.duration) {
          // Parse duration format (e.g., "45:30" or "1:15:30")
          const parts = training.duration.split(':');
          let minutes = 0;
          if (parts.length === 2) { // mm:ss format
            minutes = parseInt(parts[0]) + parseInt(parts[1]) / 60;
          } else if (parts.length === 3) { // hh:mm:ss format
            minutes = parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2]) / 60;
          }
          if (minutes > 0) {
            totalMinutes += minutes;
            validTrainings++;
          }
        }
      });

      const averageTime = validTrainings > 0 ? Math.round(totalMinutes / validTrainings) : 0;

      weeklyData.push({
        semana: `Sem ${parseInt(weeks) - i}`,
        corridas: weekTrainings.length,
        tempoMedio: averageTime
      });
    }

    res.json({ 
      athleteName: athlete.user.name,
      evolution: weeklyData 
    });

  } catch (error) {
    console.error('Get athlete evolution error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get athlete plan history
router.get('/:athleteId/plan-history', authenticate, async (req: any, res) => {
  try {
    const { athleteId } = req.params;

    // Verify that this athlete belongs to the current coach
    const currentUserCoach = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!currentUserCoach) {
      return res.status(403).json({ error: 'Coach profile not found' });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: athleteId }
    });

    if (!athlete || athlete.coachId !== currentUserCoach.id) {
      return res.status(404).json({ error: 'Athlete not found or not your athlete' });
    }

    // Get training history grouped by plan
    const trainings = await prisma.training.findMany({
      where: {
        athleteId: athlete.id,
        planId: { not: null }
      },
      include: {
        plan: {
          select: { id: true, name: true, createdAt: true, duration: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    // Group by plan and calculate completion percentage
    const planHistoryMap = new Map();

    trainings.forEach(training => {
      if (training.plan) {
        const planId = training.plan.id;
        if (!planHistoryMap.has(planId)) {
          planHistoryMap.set(planId, {
            id: planId,
            nome: training.plan.name,
            periodo: '', // Will be calculated
            conclusao: 0,
            status: 'Concluído',
            totalTrainings: 0,
            completedTrainings: 0
          });
        }

        const planData = planHistoryMap.get(planId);
        planData.totalTrainings++;
        if (training.status === 'COMPLETED') {
          planData.completedTrainings++;
        }
      }
    });

    // Calculate completion percentages and periods
    const planHistory = Array.from(planHistoryMap.values()).map(plan => {
      const completion = plan.totalTrainings > 0 
        ? Math.round((plan.completedTrainings / plan.totalTrainings) * 100)
        : 0;
      
      // Get date range for this plan
      const planTrainings = trainings.filter(t => t.plan?.id === plan.id);
      if (planTrainings.length > 0) {
        const dates = planTrainings.map(t => new Date(t.date)).sort();
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        
        plan.periodo = `${startDate.toLocaleDateString('pt-BR', { month: 'short' })} - ${endDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`;
      }
      
      return {
        ...plan,
        conclusao: completion
      };
    }).slice(0, 5); // Return last 5 plans

    res.json({ planHistory });

  } catch (error) {
    console.error('Get athlete plan history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (for coach to remove athlete)
router.delete('/:id', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Verify that the user to be deleted is an athlete of this coach
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      include: {
        athleteProfile: true
      }
    });

    if (!userToDelete || !userToDelete.athleteProfile) {
      return res.status(404).json({ error: 'Athlete not found' });
    }

    // Check if the current user is the coach of this athlete
    const currentUserCoach = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!currentUserCoach || userToDelete.athleteProfile.coachId !== currentUserCoach.id) {
      return res.status(403).json({ error: 'You can only delete your own athletes' });
    }

    // Delete the user (cascade will handle profile deletion)
    await prisma.user.delete({
      where: { id }
    });

    res.json({ message: 'Athlete deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;