"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Helper function to generate trainings from weekly programming
async function generateTrainingsForAthlete(planId, athleteId, weeklyProgramming) {
    const startDate = new Date(); // Start from today
    const trainingsToCreate = [];
    weeklyProgramming.forEach((weekProg) => {
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + (weekProg.week - 1) * 7);
        // Map day names to day numbers (0 = Sunday, 1 = Monday, etc.)
        const dayMappings = [
            { key: 'sunday', dayOffset: 0 },
            { key: 'monday', dayOffset: 1 },
            { key: 'tuesday', dayOffset: 2 },
            { key: 'wednesday', dayOffset: 3 },
            { key: 'thursday', dayOffset: 4 },
            { key: 'friday', dayOffset: 5 },
            { key: 'saturday', dayOffset: 6 }
        ];
        dayMappings.forEach(({ key, dayOffset }) => {
            const dayData = weekProg[key];
            if (dayData) {
                try {
                    const trainingData = JSON.parse(dayData);
                    const trainingDate = new Date(weekStartDate);
                    // Calculate the exact date for this day of the week
                    const currentDayOfWeek = weekStartDate.getDay();
                    const daysToAdd = (dayOffset - currentDayOfWeek + 7) % 7;
                    trainingDate.setDate(weekStartDate.getDate() + daysToAdd);
                    // Map training type from frontend to backend enum
                    const typeMapping = {
                        'Corrida Contínua': 'CONTINUOUS_RUN',
                        'Intervalado': 'INTERVAL_TRAINING',
                        'Longão': 'LONG_RUN',
                        'Fartlek': 'FARTLEK',
                        'Prova/Teste': 'INTERVAL_TRAINING', // Fallback
                        'Descanso': 'RECOVERY_RUN'
                    };
                    trainingsToCreate.push({
                        date: trainingDate,
                        type: typeMapping[trainingData.tipo] || 'CONTINUOUS_RUN',
                        distance: trainingData.distancia || '5km',
                        duration: trainingData.tempo || '30min',
                        pace: trainingData.pace || '6:00',
                        notes: trainingData.observacoes || `Treino da semana ${weekProg.week} - ${trainingData.tipo}`,
                        weekNumber: weekProg.week,
                        athleteId: athleteId,
                        planId: planId,
                        status: 'PENDING'
                    });
                }
                catch (parseError) {
                    console.error('Error parsing training data:', parseError);
                }
            }
        });
    });
    // Create all trainings for this athlete
    if (trainingsToCreate.length > 0) {
        await prisma_1.prisma.training.createMany({
            data: trainingsToCreate
        });
    }
    return trainingsToCreate.length;
}
// Get all training plans
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { category, status } = req.query;
        const whereClause = {};
        if (category) {
            whereClause.category = category;
        }
        if (status) {
            whereClause.status = status;
        }
        const plans = await prisma_1.prisma.trainingPlan.findMany({
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
    }
    catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create training plan (coaches only)
router.post('/', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH', 'ADMIN']), async (req, res) => {
    try {
        const { name, category, duration, daysPerWeek } = req.body;
        const coachProfile = await prisma_1.prisma.coachProfile.findUnique({
            where: { userId: req.userId }
        });
        if (!coachProfile) {
            return res.status(404).json({ error: 'Coach profile not found' });
        }
        const plan = await prisma_1.prisma.trainingPlan.create({
            data: {
                name,
                category,
                duration,
                daysPerWeek,
                createdById: coachProfile.id
            }
        });
        res.status(201).json({ message: 'Training plan created successfully', plan });
    }
    catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get plan details
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await prisma_1.prisma.trainingPlan.findUnique({
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
    }
    catch (error) {
        console.error('Get plan details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Assign plan to athlete
router.post('/:id/assign', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const { athleteId } = req.body;
        const plan = await prisma_1.prisma.trainingPlan.findUnique({
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
        const athlete = await prisma_1.prisma.athleteProfile.findUnique({
            where: { id: athleteId }
        });
        if (!athlete) {
            return res.status(404).json({ error: 'Athlete not found' });
        }
        // Update athlete's current plan
        await prisma_1.prisma.athleteProfile.update({
            where: { id: athleteId },
            data: {
                currentPlanId: id
            }
        });
        // Generate individual trainings based on weekly programming
        const trainingsGenerated = await generateTrainingsForAthlete(id, athleteId, plan.weeklyProgramming);
        res.json({
            message: 'Plan assigned successfully',
            trainingsGenerated: trainingsGenerated
        });
    }
    catch (error) {
        console.error('Assign plan error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get weekly programming for a plan
router.get('/:id/weekly-programming', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await prisma_1.prisma.trainingPlan.findUnique({
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
    }
    catch (error) {
        console.error('Get weekly programming error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create or update weekly programming for a plan
router.put('/:id/weekly-programming/:week', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH', 'ADMIN']), async (req, res) => {
    try {
        const { id, week } = req.params;
        const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body;
        const plan = await prisma_1.prisma.trainingPlan.findUnique({
            where: { id }
        });
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        // Check if coach owns this plan
        const coachProfile = await prisma_1.prisma.coachProfile.findUnique({
            where: { userId: req.userId }
        });
        if (!coachProfile || plan.createdById !== coachProfile.id) {
            return res.status(403).json({ error: 'Access denied. You can only modify your own plans.' });
        }
        const weekNumber = parseInt(week);
        // Upsert weekly programming
        const weeklyProgramming = await prisma_1.prisma.weeklyProgramming.upsert({
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
    }
    catch (error) {
        console.error('Update weekly programming error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Assign multiple athletes to a plan
router.post('/:id/assign-multiple', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const { athleteIds } = req.body;
        if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
            return res.status(400).json({ error: 'athleteIds must be a non-empty array' });
        }
        const plan = await prisma_1.prisma.trainingPlan.findUnique({
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
        // Check if coach owns this plan and athletes
        const coachProfile = await prisma_1.prisma.coachProfile.findUnique({
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
        await prisma_1.prisma.athleteProfile.updateMany({
            where: { id: { in: athleteIds } },
            data: { currentPlanId: id }
        });
        // Generate trainings for each athlete
        let totalTrainingsGenerated = 0;
        for (const athleteId of athleteIds) {
            const trainingsGenerated = await generateTrainingsForAthlete(id, athleteId, plan.weeklyProgramming);
            totalTrainingsGenerated += trainingsGenerated;
        }
        res.json({
            message: 'Plan assigned to multiple athletes successfully',
            athletesCount: athleteIds.length,
            totalTrainingsGenerated
        });
    }
    catch (error) {
        console.error('Assign plan to multiple athletes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get plans created by the coach
router.get('/coach/my-plans', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH']), async (req, res) => {
    try {
        const coachProfile = await prisma_1.prisma.coachProfile.findUnique({
            where: { userId: req.userId }
        });
        if (!coachProfile) {
            return res.status(404).json({ error: 'Coach profile not found' });
        }
        const plans = await prisma_1.prisma.trainingPlan.findMany({
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
    }
    catch (error) {
        console.error('Get coach plans error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get plan progress with athletes statistics
router.get('/:id/progress', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        // Get the plan with all related data
        const plan = await prisma_1.prisma.trainingPlan.findUnique({
            where: { id },
            include: {
                athletes: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true, avatar: true }
                        },
                        trainings: {
                            where: { planId: id },
                            orderBy: { date: 'desc' }
                        }
                    }
                },
                weeklyProgramming: true,
                trainings: {
                    where: { planId: id }
                }
            }
        });
        if (!plan) {
            return res.status(404).json({ error: 'Training plan not found' });
        }
        // Calculate total expected trainings per athlete
        const totalWeeks = plan.duration;
        const expectedTrainingsPerWeek = plan.daysPerWeek;
        const totalExpectedTrainings = totalWeeks * expectedTrainingsPerWeek;
        // Calculate progress for each athlete
        const athletesProgress = plan.athletes.map(athlete => {
            const completedTrainings = athlete.trainings.filter(t => t.status === 'COMPLETED').length;
            const pendingTrainings = athlete.trainings.filter(t => t.status === 'PENDING').length;
            const missedTrainings = athlete.trainings.filter(t => t.status === 'MISSED').length;
            const progressPercentage = totalExpectedTrainings > 0
                ? Math.round((completedTrainings / totalExpectedTrainings) * 100)
                : 0;
            // Calculate average pace and time from completed trainings
            const completedTrainingsList = athlete.trainings.filter(t => t.status === 'COMPLETED');
            const averageStats = calculateAverageStats(completedTrainingsList);
            return {
                id: athlete.user.id,
                athleteId: athlete.id,
                nome: athlete.user.name,
                email: athlete.user.email,
                foto: athlete.user.avatar,
                status: athlete.status,
                level: athlete.level,
                treinosTotal: totalExpectedTrainings,
                treinosRealizados: completedTrainings,
                treinosPendentes: pendingTrainings,
                treinosPerdidos: missedTrainings,
                progressoAtual: progressPercentage,
                statusPlano: progressPercentage === 100 ? 'Concluído' :
                    progressPercentage > 0 ? 'Ativo' : 'Não realizado',
                tempoMedio: averageStats.averageTime,
                ritmoMedio: averageStats.averagePace,
                ultimoTreino: completedTrainingsList[0] ? {
                    data: completedTrainingsList[0].date,
                    tipo: completedTrainingsList[0].type,
                    distancia: completedTrainingsList[0].distance,
                    pace: completedTrainingsList[0].pace
                } : null
            };
        });
        // Calculate plan-wide statistics
        const totalAthletes = plan.athletes.length;
        const activeAthletes = athletesProgress.filter(a => a.statusPlano === 'Ativo').length;
        const completedAthletes = athletesProgress.filter(a => a.statusPlano === 'Concluído').length;
        const notStartedAthletes = athletesProgress.filter(a => a.statusPlano === 'Não realizado').length;
        const averageProgress = totalAthletes > 0
            ? Math.round(athletesProgress.reduce((acc, a) => acc + a.progressoAtual, 0) / totalAthletes)
            : 0;
        const planProgress = {
            id: plan.id,
            nome: plan.name,
            categoria: plan.category,
            duracao: plan.duration,
            diasPorSemana: plan.daysPerWeek,
            status: plan.status,
            totalAlunos: totalAthletes,
            alunosAtivos: activeAthletes,
            alunosConcluidos: completedAthletes,
            alunosNaoIniciados: notStartedAthletes,
            progressoMedio: averageProgress,
            treinosTotaisPlanejados: totalExpectedTrainings * totalAthletes,
            treinosRealizadosTotal: athletesProgress.reduce((acc, a) => acc + a.treinosRealizados, 0),
            athletes: athletesProgress,
            weeklyProgramming: plan.weeklyProgramming
        };
        res.json({ planProgress });
    }
    catch (error) {
        console.error('Get plan progress error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Helper function to calculate average statistics
function calculateAverageStats(trainings) {
    if (trainings.length === 0) {
        return { averageTime: '-', averagePace: '-' };
    }
    // Calculate average pace (assuming pace is in format "MM:SS")
    const validPaces = trainings.filter(t => t.pace && t.pace !== '-');
    let averagePace = '-';
    if (validPaces.length > 0) {
        const totalSeconds = validPaces.reduce((acc, t) => {
            const [minutes, seconds] = t.pace.split(':').map(Number);
            return acc + (minutes * 60 + seconds);
        }, 0);
        const avgSeconds = Math.round(totalSeconds / validPaces.length);
        const avgMinutes = Math.floor(avgSeconds / 60);
        const remainingSeconds = avgSeconds % 60;
        averagePace = `${avgMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    // Calculate average duration (assuming duration is in format "HH:MM" or "MM")  
    const validDurations = trainings.filter(t => t.duration && t.duration !== '-');
    let averageTime = '-';
    if (validDurations.length > 0) {
        const totalMinutes = validDurations.reduce((acc, t) => {
            const duration = t.duration;
            if (duration.includes(':')) {
                const [hours, minutes] = duration.split(':').map(Number);
                return acc + (hours * 60 + minutes);
            }
            else {
                return acc + parseInt(duration);
            }
        }, 0);
        const avgMinutes = Math.round(totalMinutes / validDurations.length);
        const hours = Math.floor(avgMinutes / 60);
        const minutes = avgMinutes % 60;
        if (hours > 0) {
            averageTime = `${hours}h${minutes.toString().padStart(2, '0')}min`;
        }
        else {
            averageTime = `${minutes}min`;
        }
    }
    return { averageTime, averagePace };
}
exports.default = router;
