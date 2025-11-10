"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// GET /api/challenges - List challenges for coach
router.get('/', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH']), async (req, res) => {
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
    }
    catch (error) {
        console.error('List challenges error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/challenges - Create new challenge
router.post('/', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH']), async (req, res) => {
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
                    create: participantIds?.map((athleteId) => ({
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
    }
    catch (error) {
        console.error('Create challenge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/challenges/:id - Get specific challenge
router.get('/:id', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH']), async (req, res) => {
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
    }
    catch (error) {
        console.error('Get challenge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/challenges/:id - Update challenge
router.put('/:id', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH']), async (req, res) => {
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
                status: status
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
    }
    catch (error) {
        console.error('Update challenge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/challenges/:id - Delete challenge
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH']), async (req, res) => {
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
    }
    catch (error) {
        console.error('Delete challenge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/challenges/:id/participants - Add participant to challenge
router.post('/:id/participants', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH']), async (req, res) => {
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
    }
    catch (error) {
        console.error('Add participant error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/challenges/:id/participants/:participantId - Update participant progress
router.put('/:id/participants/:participantId', auth_1.authenticate, (0, auth_1.authorizeRole)(['COACH']), async (req, res) => {
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
    }
    catch (error) {
        console.error('Update participant error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
