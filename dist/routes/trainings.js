"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get trainings for athlete
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        const athleteProfile = await prisma_1.prisma.athleteProfile.findUnique({
            where: { userId: req.userId }
        });
        if (!athleteProfile) {
            return res.status(404).json({ error: 'Athlete profile not found' });
        }
        const whereClause = {
            athleteId: athleteProfile.id
        };
        if (startDate && endDate) {
            whereClause.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }
        if (status) {
            whereClause.status = status;
        }
        const trainings = await prisma_1.prisma.training.findMany({
            where: whereClause,
            include: {
                plan: {
                    select: { name: true }
                }
            },
            orderBy: { date: 'asc' }
        });
        res.json({ trainings });
    }
    catch (error) {
        console.error('Get trainings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create training
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const { date, type, distance, duration, pace, notes, planId } = req.body;
        const athleteProfile = await prisma_1.prisma.athleteProfile.findUnique({
            where: { userId: req.userId }
        });
        if (!athleteProfile) {
            return res.status(404).json({ error: 'Athlete profile not found' });
        }
        const training = await prisma_1.prisma.training.create({
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
    }
    catch (error) {
        console.error('Create training error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update training status
router.patch('/:id/status', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const training = await prisma_1.prisma.training.findUnique({
            where: { id },
            include: { athlete: true }
        });
        if (!training) {
            return res.status(404).json({ error: 'Training not found' });
        }
        if (training.athlete.userId !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const updatedTraining = await prisma_1.prisma.training.update({
            where: { id },
            data: { status }
        });
        // Update athlete's completed trainings count if status is COMPLETED
        if (status === 'COMPLETED') {
            await prisma_1.prisma.athleteProfile.update({
                where: { id: training.athleteId },
                data: {
                    completedTrainings: {
                        increment: 1
                    }
                }
            });
        }
        res.json({ message: 'Training status updated', training: updatedTraining });
    }
    catch (error) {
        console.error('Update training status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get training details
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const training = await prisma_1.prisma.training.findUnique({
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
    }
    catch (error) {
        console.error('Get training details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get athlete trainings for coach
router.get('/athlete/:athleteId', auth_1.authenticate, async (req, res) => {
    try {
        const { athleteId } = req.params;
        const { planId, limit = '10' } = req.query;
        // First, check if the requesting user is a coach
        const coachProfile = await prisma_1.prisma.coachProfile.findUnique({
            where: { userId: req.userId }
        });
        if (!coachProfile) {
            return res.status(403).json({ error: 'Only coaches can access athlete trainings' });
        }
        // Check if athlete belongs to this coach
        const athleteProfile = await prisma_1.prisma.athleteProfile.findUnique({
            where: {
                id: athleteId,
                coachId: coachProfile.id
            }
        });
        if (!athleteProfile) {
            return res.status(404).json({ error: 'Athlete not found or not assigned to this coach' });
        }
        const whereClause = {
            athleteId: athleteId
        };
        if (planId) {
            whereClause.planId = planId;
        }
        const trainings = await prisma_1.prisma.training.findMany({
            where: whereClause,
            include: {
                plan: {
                    select: { name: true }
                }
            },
            orderBy: { date: 'desc' },
            take: parseInt(limit)
        });
        // Calculate performance statistics
        const completedTrainings = trainings.filter(t => t.status === 'COMPLETED');
        let performanceStats = {
            totalTrainings: trainings.length,
            completedTrainings: completedTrainings.length,
            completionRate: trainings.length > 0 ? Math.round((completedTrainings.length / trainings.length) * 100) : 0,
            averagePace: '-',
            averageDuration: '-',
            lastTraining: null
        };
        if (completedTrainings.length > 0) {
            // Calculate average pace
            const validPaces = completedTrainings.filter(t => t.pace && t.pace !== '-');
            if (validPaces.length > 0) {
                const totalSeconds = validPaces.reduce((acc, t) => {
                    const [minutes, seconds] = t.pace.split(':').map(Number);
                    return acc + (minutes * 60 + seconds);
                }, 0);
                const avgSeconds = Math.round(totalSeconds / validPaces.length);
                const avgMinutes = Math.floor(avgSeconds / 60);
                const remainingSeconds = avgSeconds % 60;
                performanceStats.averagePace = `${avgMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
            }
            // Calculate average duration
            const validDurations = completedTrainings.filter(t => t.duration && t.duration !== '-');
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
                    performanceStats.averageDuration = `${hours}h${minutes.toString().padStart(2, '0')}min`;
                }
                else {
                    performanceStats.averageDuration = `${minutes}min`;
                }
            }
            // Get last training
            if (trainings.length > 0) {
                const lastTraining = trainings[0];
                performanceStats.lastTraining = {
                    id: lastTraining.id,
                    data: lastTraining.date,
                    tipo: lastTraining.type,
                    distancia: lastTraining.distance,
                    pace: lastTraining.pace,
                    duracao: lastTraining.duration,
                    status: lastTraining.status
                };
            }
        }
        res.json({
            trainings: trainings.map(t => ({
                id: t.id,
                data: t.date,
                tipo: t.type,
                distancia: t.distance,
                duracao: t.duration,
                pace: t.pace,
                notes: t.notes,
                status: t.status,
                plano: t.plan?.name
            })),
            performanceStats
        });
    }
    catch (error) {
        console.error('Get athlete trainings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
