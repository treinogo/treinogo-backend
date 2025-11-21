import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Get current subscription
router.get('/current', authenticate, async (req: any, res) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId },
      include: { subscription: true }
    });

    if (!coachProfile) {
      return res.status(404).json({ error: 'Coach profile not found' });
    }

    // If no subscription exists, return FREE plan
    if (!coachProfile.subscription) {
      return res.json({
        subscription: {
          planType: 'FREE',
          status: 'ACTIVE',
          startDate: coachProfile.id ? new Date() : new Date()
        }
      });
    }

    res.json({ subscription: coachProfile.subscription });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Get all available plans
router.get('/plans', async (req, res) => {
  const plans = [
    {
      id: 'free',
      name: 'Gratuito',
      price: 0,
      period: 'Sempre grátis',
      features: ['Até 5 alunos', '1 plano de treino', 'Relatórios básicos', 'Suporte por email'],
      maxAthletes: 5
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 49.90,
      period: '/mês',
      features: ['Até 20 alunos', 'Planos ilimitados', 'Relatórios avançados', 'Desafios e gamificação', 'Suporte prioritário'],
      maxAthletes: 20
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 99.90,
      period: '/mês',
      popular: true,
      features: ['Até 50 alunos', 'Planos ilimitados', 'Relatórios personalizados', 'Desafios e gamificação', 'Testes físicos integrados', 'Calendário de provas', 'Suporte 24/7'],
      maxAthletes: 50
    },
    {
      id: 'business',
      name: 'Business',
      price: 199.90,
      period: '/mês',
      features: ['Até 150 alunos', 'Tudo do Pro +', 'API de integração', 'Branding personalizado', 'Múltiplos professores', 'Análises com IA', 'Gerente de conta dedicado'],
      maxAthletes: 150
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: null,
      period: 'Personalizado',
      features: ['Alunos ilimitados', 'Tudo do Business +', 'Infraestrutura dedicada', 'SLA garantido', 'Treinamento da equipe', 'Consultoria estratégica', 'Suporte premium'],
      maxAthletes: -1
    }
  ];

  res.json({ plans });
});

// Update subscription (upgrade/downgrade)
router.post('/update', authenticate, async (req: any, res) => {
  try {
    const { planType } = req.body;

    if (!planType) {
      return res.status(400).json({ error: 'Plan type is required' });
    }

    const validPlans = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'];
    if (!validPlans.includes(planType.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!coachProfile) {
      return res.status(404).json({ error: 'Coach profile not found' });
    }

    // Upsert subscription
    const subscription = await prisma.subscription.upsert({
      where: { coachId: coachProfile.id },
      update: {
        planType: planType.toUpperCase(),
        status: 'ACTIVE',
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      },
      create: {
        coachId: coachProfile.id,
        planType: planType.toUpperCase(),
        status: 'ACTIVE',
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({ subscription, message: 'Subscription updated successfully' });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Cancel subscription
router.post('/cancel', authenticate, async (req: any, res) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId },
      include: { subscription: true }
    });

    if (!coachProfile) {
      return res.status(404).json({ error: 'Coach profile not found' });
    }

    if (!coachProfile.subscription) {
      return res.status(400).json({ error: 'No active subscription to cancel' });
    }

    const subscription = await prisma.subscription.update({
      where: { coachId: coachProfile.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        planType: 'FREE'
      }
    });

    res.json({ subscription, message: 'Subscription cancelled. You now have the Free plan.' });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
