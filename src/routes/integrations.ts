import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// GET /api/integrations/status - Get integration status
router.get('/status', authenticate, async (req: any, res) => {
  try {
    // In a real application, you would fetch this from a database
    // For now, return mock data
    const integrations = {
      strava: {
        connected: false,
        connectedAt: null,
        user: null
      },
      polar: {
        connected: false,
        connectedAt: null,
        user: null
      },
      garmin: {
        connected: false,
        connectedAt: null,
        user: null
      }
    };

    res.json({ integrations });
  } catch (error) {
    console.error('Get integrations status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/integrations/:type/connect - Connect integration
router.post('/:type/connect', authenticate, async (req: any, res) => {
  try {
    const { type } = req.params;

    if (!['strava', 'polar', 'garmin'].includes(type)) {
      return res.status(400).json({ error: 'Invalid integration type' });
    }

    // In a real application, you would:
    // 1. Initiate OAuth flow
    // 2. Store credentials
    // 3. Return OAuth URL for user to authorize
    console.log(`User ${req.userId} connecting to ${type}`);

    res.json({
      success: true,
      message: `${type} connected successfully`,
      connected: true,
      connectedAt: new Date(),
      user: req.userId
    });
  } catch (error) {
    console.error('Connect integration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/integrations/:type/disconnect - Disconnect integration
router.post('/:type/disconnect', authenticate, async (req: any, res) => {
  try {
    const { type } = req.params;

    if (!['strava', 'polar', 'garmin'].includes(type)) {
      return res.status(400).json({ error: 'Invalid integration type' });
    }

    // In a real application, you would remove stored credentials
    console.log(`User ${req.userId} disconnecting from ${type}`);

    res.json({
      success: true,
      message: `${type} disconnected successfully`,
      connected: false
    });
  } catch (error) {
    console.error('Disconnect integration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
