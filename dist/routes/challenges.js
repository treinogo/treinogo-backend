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
// GET /api/challenges - List challenges (for coach or athlete)
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        // Check if user is a coach
        const coach = await prisma.coachProfile.findUnique({
            where: { userId }
        });
        if (coach) {
            // Return challenges created by this coach
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
            return res.json({ challenges });
        }
        // Otherwise, user is an athlete - return their challenges
        const athlete = await prisma.athleteProfile.findUnique({
            where: { userId }
        });
        if (!athlete) {
            return res.status(403).json({ error: 'No profile found' });
        }
        const participations = await prisma.challengeParticipant.findMany({
            where: { athleteId: athlete.id },
            include: {
                challenge: {
                    include: {
                        createdBy: {
                            include: {
                                user: {
                                    select: { name: true }
                                }
                            }
                        },
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
                        },
                        _count: {
                            select: { participants: true }
                        }
                    }
                }
            },
            orderBy: { joinedAt: 'desc' }
        });
        const challenges = participations.map(p => ({
            ...p.challenge,
            myProgress: p.progress,
            myPoints: p.points,
            myRank: p.challenge.participants.findIndex(participant => participant.athleteId === athlete.id) + 1
        }));
        res.json({ challenges });
    }
    catch (error) {
        console.error('List challenges error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/challenges/available - List available challenges for athlete (not yet joined)
router.get('/available', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const athlete = await prisma.athleteProfile.findUnique({
            where: { userId }
        });
        if (!athlete) {
            return res.status(403).json({ error: 'No athlete profile found' });
        }
        // Get challenges where athlete has a coach and the challenge is from that coach
        // and athlete is not yet a participant
        const availableChallenges = await prisma.challenge.findMany({
            where: {
                status: client_1.ChallengeStatus.ACTIVE,
                createdById: athlete.coachId || undefined,
                participants: {
                    none: {
                        athleteId: athlete.id
                    }
                }
            },
            include: {
                createdBy: {
                    include: {
                        user: {
                            select: { name: true }
                        }
                    }
                },
                _count: {
                    select: { participants: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ challenges: availableChallenges });
    }
    catch (error) {
        console.error('List available challenges error:', error);
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
// POST /api/challenges/:id/join - Athlete joins a challenge
router.post('/:id/join', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const athlete = await prisma.athleteProfile.findUnique({
            where: { userId }
        });
        if (!athlete) {
            return res.status(403).json({ error: 'Access denied. Athlete profile required.' });
        }
        // Verify challenge exists and is active
        const challenge = await prisma.challenge.findUnique({
            where: { id }
        });
        if (!challenge) {
            return res.status(404).json({ error: 'Challenge not found' });
        }
        if (challenge.status !== client_1.ChallengeStatus.ACTIVE) {
            return res.status(400).json({ error: 'Challenge is not active' });
        }
        // Check if athlete has a coach
        if (!athlete.coachId) {
            return res.status(403).json({ error: 'You need a coach to join challenges' });
        }
        // Check if challenge is from athlete's coach
        if (challenge.createdById !== athlete.coachId) {
            return res.status(403).json({ error: 'You can only join challenges from your coach' });
        }
        // Check if already participating
        const existingParticipation = await prisma.challengeParticipant.findUnique({
            where: {
                challengeId_athleteId: {
                    challengeId: id,
                    athleteId: athlete.id
                }
            }
        });
        if (existingParticipation) {
            return res.status(400).json({ error: 'Already participating in this challenge' });
        }
        // Create participation
        const participant = await prisma.challengeParticipant.create({
            data: {
                challengeId: id,
                athleteId: athlete.id,
                progress: 0,
                points: 0
            },
            include: {
                challenge: {
                    include: {
                        createdBy: {
                            include: {
                                user: {
                                    select: { name: true }
                                }
                            }
                        },
                        _count: {
                            select: { participants: true }
                        }
                    }
                }
            }
        });
        res.status(201).json({ participant });
    }
    catch (error) {
        console.error('Join challenge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
