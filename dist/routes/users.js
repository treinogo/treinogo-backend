"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get user profile
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
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
    }
    catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update user profile
router.put('/me', auth_1.authenticate, async (req, res) => {
    try {
        const { name, phone, age, avatar } = req.body;
        const user = await prisma_1.prisma.user.update({
            where: { id: req.userId },
            data: {
                name,
                phone,
                age,
                avatar
            }
        });
        res.json({ message: 'Profile updated successfully', user });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get athletes (for coaches)
router.get('/athletes', auth_1.authenticate, async (req, res) => {
    try {
        const coach = await prisma_1.prisma.coachProfile.findUnique({
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
    }
    catch (error) {
        console.error('Get athletes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update athlete (for coaches)
router.put('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, age } = req.body;
        // Verify that the user to be updated is an athlete of this coach
        const userToUpdate = await prisma_1.prisma.user.findUnique({
            where: { id },
            include: {
                athleteProfile: true
            }
        });
        if (!userToUpdate || !userToUpdate.athleteProfile) {
            return res.status(404).json({ error: 'Athlete not found' });
        }
        // Check if the current user is the coach of this athlete
        const currentUserCoach = await prisma_1.prisma.coachProfile.findUnique({
            where: { userId: req.userId }
        });
        if (!currentUserCoach || userToUpdate.athleteProfile.coachId !== currentUserCoach.id) {
            return res.status(403).json({ error: 'You can only update your own athletes' });
        }
        // Update the user
        const updatedUser = await prisma_1.prisma.user.update({
            where: { id },
            data: {
                name,
                email,
                phone,
                age: age ? parseInt(age) : null
            }
        });
        res.json({ message: 'Athlete updated successfully', user: updatedUser });
    }
    catch (error) {
        console.error('Update athlete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete user (for coach to remove athlete)
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        // Verify that the user to be deleted is an athlete of this coach
        const userToDelete = await prisma_1.prisma.user.findUnique({
            where: { id },
            include: {
                athleteProfile: true
            }
        });
        if (!userToDelete || !userToDelete.athleteProfile) {
            return res.status(404).json({ error: 'Athlete not found' });
        }
        // Check if the current user is the coach of this athlete
        const currentUserCoach = await prisma_1.prisma.coachProfile.findUnique({
            where: { userId: req.userId }
        });
        if (!currentUserCoach || userToDelete.athleteProfile.coachId !== currentUserCoach.id) {
            return res.status(403).json({ error: 'You can only delete your own athletes' });
        }
        // Delete the user (cascade will handle profile deletion)
        await prisma_1.prisma.user.delete({
            where: { id }
        });
        res.json({ message: 'Athlete deleted successfully' });
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
