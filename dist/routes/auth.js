"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const router = express_1.default.Router();
// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, role = 'ATHLETE', coachId } = req.body;
        // Check if user exists
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        // Create user
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: role
            }
        });
        // Create profile based on role
        if (role === 'ATHLETE') {
            await prisma_1.prisma.athleteProfile.create({
                data: {
                    userId: user.id,
                    coachId: coachId || null // Associate with coach if provided
                }
            });
        }
        else if (role === 'COACH') {
            await prisma_1.prisma.coachProfile.create({
                data: { userId: user.id }
            });
        }
        // Generate token
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find user
        const user = await prisma_1.prisma.user.findUnique({
            where: { email },
            include: {
                athleteProfile: true,
                coachProfile: true
            }
        });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        // Check password
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        // Generate token
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                profile: user.athleteProfile || user.coachProfile
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Register athlete by coach (authenticated)
router.post('/register-athlete', async (req, res) => {
    try {
        // This endpoint requires authentication middleware
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Access denied. Invalid token format.' });
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        }
        catch (error) {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        // Get coach profile
        const coachProfile = await prisma_1.prisma.coachProfile.findUnique({
            where: { userId: decoded.userId }
        });
        if (!coachProfile) {
            return res.status(403).json({ error: 'Access denied. Coach profile required.' });
        }
        const { email, name, phone, age, level, status } = req.body;
        // Check if user exists
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        // Hash default password
        const hashedPassword = await bcryptjs_1.default.hash('123456', 12);
        // Create user
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                phone,
                age: age ? parseInt(age) : null,
                role: 'ATHLETE'
            }
        });
        // Create athlete profile with coach association
        const athleteProfile = await prisma_1.prisma.athleteProfile.create({
            data: {
                userId: user.id,
                coachId: coachProfile.id,
                level: level || 'BEGINNER',
                status: status || 'ACTIVE'
            }
        });
        res.status(201).json({
            message: 'Athlete created successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            athleteProfile
        });
    }
    catch (error) {
        console.error('Register athlete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
