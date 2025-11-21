import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Middleware para autenticação
const authMiddleware = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Gerar código de referral único
const generateReferralCode = (name: string): string => {
  const cleanName = name.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6);
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${cleanName}${randomNum}`;
};

// GET /api/referrals/my-code - Obter código de afiliado do coach
router.get('/my-code', authMiddleware, async (req: any, res) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId },
      include: { user: true }
    });

    if (!coachProfile) {
      return res.status(404).json({ error: 'Perfil de coach não encontrado' });
    }

    // Se não tem código, gerar um
    let referralCode = coachProfile.referralCode;
    if (!referralCode) {
      referralCode = generateReferralCode(coachProfile.user.name);
      await prisma.coachProfile.update({
        where: { id: coachProfile.id },
        data: { referralCode }
      });
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://treinogo.com';

    res.json({
      code: referralCode,
      link: `${baseUrl}/ref/${referralCode}`
    });
  } catch (error) {
    console.error('Erro ao obter código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/referrals - Listar convites do coach
router.get('/', authMiddleware, async (req: any, res) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!coachProfile) {
      return res.status(404).json({ error: 'Perfil de coach não encontrado' });
    }

    const referrals = await prisma.referral.findMany({
      where: { coachId: coachProfile.id },
      orderBy: { sentAt: 'desc' }
    });

    res.json({ referrals });
  } catch (error) {
    console.error('Erro ao listar convites:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/referrals/stats - Estatísticas de indicações
router.get('/stats', authMiddleware, async (req: any, res) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!coachProfile) {
      return res.status(404).json({ error: 'Perfil de coach não encontrado' });
    }

    const referrals = await prisma.referral.findMany({
      where: { coachId: coachProfile.id }
    });

    const totalConvites = referrals.length;
    const recompensasRecebidas = referrals.filter(r => r.status === 'REWARDED').length;
    const descontoAcumulado = referrals
      .filter(r => r.status === 'REWARDED')
      .reduce((acc, r) => acc + r.discount, 0);

    res.json({
      totalConvites,
      recompensasRecebidas,
      descontoAcumulado: Math.min(descontoAcumulado, 100) // Max 100%
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/referrals - Criar novo convite
router.post('/', authMiddleware, async (req: any, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!coachProfile) {
      return res.status(404).json({ error: 'Perfil de coach não encontrado' });
    }

    // Verificar se já existe convite para este email
    const existingReferral = await prisma.referral.findFirst({
      where: { coachId: coachProfile.id, email }
    });

    if (existingReferral) {
      return res.status(400).json({ error: 'Já existe um convite para este email' });
    }

    const referral = await prisma.referral.create({
      data: {
        coachId: coachProfile.id,
        email,
        status: 'SENT'
      }
    });

    res.status(201).json({ referral });
  } catch (error) {
    console.error('Erro ao criar convite:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/referrals/:id - Excluir convite
router.delete('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.userId }
    });

    if (!coachProfile) {
      return res.status(404).json({ error: 'Perfil de coach não encontrado' });
    }

    const referral = await prisma.referral.findFirst({
      where: { id, coachId: coachProfile.id }
    });

    if (!referral) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }

    await prisma.referral.delete({ where: { id } });

    res.json({ message: 'Convite excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir convite:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
