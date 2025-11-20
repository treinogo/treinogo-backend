import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorizeRole } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

interface AuthRequest extends express.Request {
  userId?: string;
  userRole?: string;
}

// GET /api/dashboard/metrics - Get dashboard metrics for coach
router.get('/metrics', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      include: {
        athletes: {
          include: {
            trainings: true,
            challengeParticipations: true
          }
        },
        trainingPlans: true,
        challenges: {
          include: {
            participants: true
          }
        }
      }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    // Calculate metrics
    const alunosAtivos = coach.athletes.filter(a => a.status === 'ACTIVE').length;
    const totalAlunos = coach.athletes.length;
    const planosAtivos = coach.trainingPlans.filter(p => p.status === 'ACTIVE').length;
    const totalPlanos = coach.trainingPlans.length;
    const desafiosAtivos = coach.challenges.filter(c => c.status === 'ACTIVE').length;
    const totalDesafios = coach.challenges.length;

    // Calculate completion rate
    const totalTrainings = coach.athletes.flatMap(a => a.trainings).length;
    const completedTrainings = coach.athletes.flatMap(a => 
      a.trainings.filter(t => t.status === 'COMPLETED')
    ).length;
    const taxaConclusao = totalTrainings > 0 ? Math.round((completedTrainings / totalTrainings) * 100) : 0;

    // Calculate month-over-month variations
    const currentMonth = new Date();
    const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const currentMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

    // Athletes active this month vs last month
    const activeThisMonth = await prisma.athleteProfile.count({
      where: {
        coachId: coach.id,
        status: 'ACTIVE',
        user: {
          createdAt: { lt: new Date() } // Exclude very recent signups
        }
      }
    });

    const activeLastMonth = await prisma.athleteProfile.count({
      where: {
        coachId: coach.id,
        status: 'ACTIVE',
        user: {
          createdAt: { lt: currentMonthStart }
        }
      }
    });

    const alunosVariacao = activeLastMonth > 0 ? Math.round(((activeThisMonth - activeLastMonth) / activeLastMonth) * 100) : 0;

    // Plans created this month vs last month
    const plansThisMonth = await prisma.trainingPlan.count({
      where: {
        createdById: coach.id,
        createdAt: { gte: currentMonthStart }
      }
    });

    const plansLastMonth = await prisma.trainingPlan.count({
      where: {
        createdById: coach.id,
        createdAt: { gte: lastMonth, lt: currentMonthStart }
      }
    });

    const planosVariacao = plansLastMonth > 0 ? Math.round(((plansThisMonth - plansLastMonth) / plansLastMonth) * 100) : (plansThisMonth > 0 ? 100 : 0);

    // Challenges engagement rate
    const totalChallengeParticipations = coach.challenges.flatMap(c => c.participants || []).length;
    const engajamentoDesafios = totalAlunos > 0 && totalDesafios > 0 ? Math.round((totalChallengeParticipations / (totalAlunos * totalDesafios)) * 100) : 85;

    // Completion rate vs average (mock average for now)
    const mediaProfessores = 75; // This would come from a system-wide calculation in a real system
    const variacaoVsMedia = taxaConclusao - mediaProfessores;

    // Recent activities (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const atividadesRecentes: Array<{
      id: string;
      tipo: 'plano' | 'desafio' | 'aluno';
      descricao: string;
      data: Date;
    }> = [];

    // Recent plans
    const recentPlans = await prisma.trainingPlan.findMany({
      where: {
        createdById: coach.id,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    recentPlans.forEach(plan => {
      atividadesRecentes.push({
        id: plan.id,
        tipo: 'plano' as const,
        descricao: `Plano "${plan.name}" foi criado`,
        data: plan.createdAt
      });
    });

    // Recent challenges
    const recentChallenges = await prisma.challenge.findMany({
      where: {
        createdById: coach.id,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    recentChallenges.forEach(challenge => {
      atividadesRecentes.push({
        id: challenge.id,
        tipo: 'desafio' as const,
        descricao: `Desafio "${challenge.name}" foi criado`,
        data: challenge.createdAt
      });
    });

    // Recent athlete progress
    const recentTrainings = await prisma.training.findMany({
      where: {
        athlete: { coachId: coach.id },
        status: 'COMPLETED',
        updatedAt: { gte: thirtyDaysAgo }
      },
      include: {
        athlete: {
          include: {
            user: { select: { name: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });

    recentTrainings.forEach(training => {
      atividadesRecentes.push({
        id: training.id,
        tipo: 'aluno' as const,
        descricao: `${training.athlete.user.name} concluiu um treino de ${training.type}`,
        data: training.updatedAt
      });
    });

    // Sort all activities by date
    atividadesRecentes.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const metrics = {
      alunosAtivos,
      totalAlunos,
      planosAtivos,
      totalPlanos,
      desafiosAtivos,
      totalDesafios,
      taxaConclusao,
      // Variations and feedback
      alunosVariacao: alunosVariacao >= 0 ? `+${alunosVariacao}%` : `${alunosVariacao}%`,
      alunosFeedback: alunosVariacao >= 0 ? `+${Math.abs(alunosVariacao)}% vs mês anterior` : `${alunosVariacao}% vs mês anterior`,
      planosVariacao: planosVariacao >= 0 ? `+${planosVariacao}` : `${planosVariacao}`,
      planosFeedback: plansThisMonth > 0 ? `${plansThisMonth} novo${plansThisMonth > 1 ? 's' : ''} este mês` : 'Nenhum novo este mês',
      desafiosVariacao: '0',
      desafiosFeedback: `${engajamentoDesafios}% taxa de engajamento`,
      conclusaoVariacao: variacaoVsMedia >= 0 ? `+${variacaoVsMedia}%` : `${variacaoVsMedia}%`,
      conclusaoFeedback: `${variacaoVsMedia >= 0 ? '+' : ''}${variacaoVsMedia}% vs média`,
      mediaProfessores,
      atividadesRecentes: atividadesRecentes.slice(0, 10) // Top 10 most recent
    };

    res.json({ metrics });
  } catch (error) {
    console.error('Get dashboard metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/training-stats - Get training completion stats by month
router.get('/training-stats', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { year = new Date().getFullYear() } = req.query;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);

    // Get training data by month
    const trainings = await prisma.training.findMany({
      where: {
        athlete: { coachId: coach.id },
        date: {
          gte: startOfYear,
          lte: endOfYear
        },
        status: 'COMPLETED'
      },
      select: {
        date: true,
        athlete: {
          select: { id: true }
        }
      }
    });

    // Group by month
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      treinos: 0,
      alunos: new Set<string>()
    }));

    trainings.forEach(training => {
      const month = new Date(training.date).getMonth(); // 0-indexed
      monthlyStats[month].treinos++;
      monthlyStats[month].alunos.add(training.athlete.id);
    });

    // Convert Set to count
    const treinosRealizadosPorMes = monthlyStats.map(stat => ({
      mes: stat.mes,
      treinos: stat.treinos,
      alunos: stat.alunos.size
    }));

    res.json({ treinosRealizadosPorMes });
  } catch (error) {
    console.error('Get training stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/challenge-progress - Get progress of active challenges
router.get('/challenge-progress', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const activeChallenges = await prisma.challenge.findMany({
      where: {
        createdById: coach.id,
        status: 'ACTIVE'
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

    const challengeProgress = activeChallenges.map(challenge => {
      const totalParticipants = challenge.participants.length;
      const averageProgress = totalParticipants > 0 
        ? challenge.participants.reduce((sum, p) => sum + p.progress, 0) / totalParticipants
        : 0;

      return {
        id: challenge.id,
        name: challenge.name,
        participants: totalParticipants,
        averageProgress: Math.round(averageProgress),
        participantDetails: challenge.participants.map(p => ({
          athleteId: p.athlete.id,
          athleteName: p.athlete.user.name,
          progress: p.progress,
          points: p.points
        }))
      };
    });

    res.json({ challengeProgress });
  } catch (error) {
    console.error('Get challenge progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/upcoming-races - Get upcoming races in the next months
router.get('/upcoming-races', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { months = 3 } = req.query;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(now.getMonth() + parseInt(months as string));

    const upcomingRaces = await prisma.race.findMany({
      where: {
        createdById: coach.id,
        raceDate: {
          gte: now,
          lte: futureDate
        }
      },
      orderBy: { raceDate: 'asc' }
    });

    // Group by month
    const racesByMonth = upcomingRaces.reduce((acc, race) => {
      const month = new Date(race.raceDate).getMonth() + 1; // 1-indexed
      if (!acc[month]) acc[month] = [];
      acc[month].push(race);
      return acc;
    }, {} as Record<number, any[]>);

    res.json({ upcomingRaces: racesByMonth });
  } catch (error) {
    console.error('Get upcoming races error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/recent-activities - Get recent activities
router.get('/recent-activities', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { limit = 10 } = req.query;

    const coach = await prisma.coachProfile.findUnique({
      where: { userId }
    });

    if (!coach) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const atividadesRecentes: Array<{
      id: string;
      tipo: 'plano' | 'desafio' | 'aluno';
      descricao: string;
      data: Date;
    }> = [];

    // Recent plans
    const recentPlans = await prisma.trainingPlan.findMany({
      where: {
        createdById: coach.id,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    recentPlans.forEach(plan => {
      atividadesRecentes.push({
        id: plan.id,
        tipo: 'plano' as const,
        descricao: `Plano "${plan.name}" foi criado`,
        data: plan.createdAt
      });
    });

    // Recent challenges
    const recentChallenges = await prisma.challenge.findMany({
      where: {
        createdById: coach.id,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    recentChallenges.forEach(challenge => {
      atividadesRecentes.push({
        id: challenge.id,
        tipo: 'desafio' as const,
        descricao: `Desafio "${challenge.name}" foi criado`,
        data: challenge.createdAt
      });
    });

    // Recent athletes
    const recentAthletes = await prisma.athleteProfile.findMany({
      where: {
        coachId: coach.id,
        user: {
          createdAt: { gte: thirtyDaysAgo }
        }
      },
      include: {
        user: { select: { name: true, createdAt: true } }
      },
      orderBy: { user: { createdAt: 'desc' } },
      take: 5
    });

    recentAthletes.forEach(athlete => {
      atividadesRecentes.push({
        id: athlete.id,
        tipo: 'aluno' as const,
        descricao: `${athlete.user.name} se inscreveu como aluno`,
        data: athlete.user.createdAt
      });
    });

    // Recent physical tests
    const recentTests = await prisma.physicalTest.findMany({
      where: {
        athlete: { coachId: coach.id },
        createdAt: { gte: thirtyDaysAgo }
      },
      include: {
        athlete: {
          include: {
            user: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    recentTests.forEach(test => {
      atividadesRecentes.push({
        id: test.id,
        tipo: 'aluno' as const,
        descricao: `${test.athlete.user.name} realizou teste de ${test.testType}`,
        data: test.createdAt
      });
    });

    // Sort all activities by date and limit
    atividadesRecentes.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    res.json({ atividadesRecentes: atividadesRecentes.slice(0, parseInt(limit as string)) });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/tips - Get daily training tips
router.get('/tips', authenticate, authorizeRole(['COACH']), async (req: AuthRequest, res) => {
  try {
    const tips = [
      'Lembre-se: equilíbrio é a chave do progresso!',
      'Varie os treinos intervalados para melhorar o desempenho.',
      'O descanso é tão importante quanto o treino.',
      'Progressão gradual evita lesões e melhora resultados.',
      'Acompanhe a evolução dos seus alunos semanalmente.',
      'Hidratação adequada faz toda a diferença no desempenho.',
      'Treinos de força complementam o trabalho de resistência.',
      'Estabeleça metas claras e mensuráveis com seus atletas.',
      'A alimentação pré-treino impacta diretamente no rendimento.',
      'Ouça o feedback dos seus alunos para ajustar os planos.',
      'Técnica de corrida é fundamental para evitar lesões.',
      'Varie os percursos para manter a motivação alta.',
      'O aquecimento adequado prepara o corpo para o esforço.',
      'Periodização do treino gera melhores resultados a longo prazo.',
      'Recuperação ativa acelera a adaptação muscular.'
    ];

    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    res.json({ tip: randomTip });
  } catch (error) {
    console.error('Get tips error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;