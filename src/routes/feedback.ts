import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// POST /api/feedback - Submit feedback
router.post('/', authenticate, async (req: any, res) => {
  try {
    const { rating, categoria, mensagem } = req.body;

    if (!rating || !categoria || !mensagem) {
      return res.status(400).json({ error: 'Rating, categoria, and mensagem are required' });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: req.userId,
        rating,
        categoria,
        mensagem,
      }
    });

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
