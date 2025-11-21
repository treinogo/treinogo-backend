import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const router = express.Router();

const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper to generate JWT
function generateToken(user: { id: string; role: string }) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

/* ============================================================
   REGISTER
   ============================================================ */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role = 'ATHLETE', coachId } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role
      }
    });

    if (role === 'ATHLETE') {
      await prisma.athleteProfile.create({
        data: { userId: user.id, coachId: coachId || null }
      });
    } else if (role === 'COACH') {
      await prisma.coachProfile.create({ data: { userId: user.id } });
    }

    const token = generateToken(user);

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
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ============================================================
   LOGIN NORMAL
   ============================================================ */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { athleteProfile: true, coachProfile: true }
    });

    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    if (!user.password) {
      return res.status(400).json({ error: 'Este usuário só pode logar com Google' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = generateToken(user);

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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ============================================================
   GOOGLE LOGIN (SOMENTE PARA USUÁRIOS JÁ CADASTRADOS!)
   ============================================================ */
router.post("/google", async (req, res) => {
  try {
    const idToken = req.body.idToken;

    if (!idToken) {
      return res.status(400).json({ error: "Missing Google ID Token" });
    }

    // Validate Google token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const email = payload.email;
    if (!email) {
      return res.status(400).json({ error: "Google account has no email" });
    }

    // Search ONLY for existing user (do NOT create)
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        athleteProfile: true,
        coachProfile: true,
      },
    });

    if (!user) {
      return res.status(403).json({
        error:
          "Usuário não encontrado. Faça o cadastro no app antes de usar o Google Login."
      });
    }

    // Generate JWT
    const token = generateToken(user);
    console.log("Google login successful for user:", user.email);
    return res.json({
      message: "Google login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile: user.athleteProfile || user.coachProfile,
      },
    });
    

  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({ error: "Failed to authenticate with Google" });
  }
});

/* ============================================================
   REGISTER ATHLETE (COACH ONLY)
   ============================================================ */
router.post('/register-athlete', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Access denied. No token provided.' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Invalid token format.' });

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: decoded.userId }
    });

    if (!coachProfile) {
      return res.status(403).json({ error: 'Access denied. Coach profile required.' });
    }

    const { email, name, phone, age, level, status } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash('123456', 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        age: age ? parseInt(age) : null,
        role: 'ATHLETE'
      }
    });

    const athleteProfile = await prisma.athleteProfile.create({
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
  } catch (error) {
    console.error('Register athlete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
