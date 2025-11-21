import express from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Strava OAuth configuration
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || 'http://localhost:5174/settings';
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

// GET /api/integrations/status - Get integration status
router.get('/status', authenticate, async (req: any, res) => {
  try {
    const integrations = await prisma.userIntegration.findMany({
      where: { userId: req.userId },
      select: {
        platform: true,
        isConnected: true,
        lastSync: true,
      },
    });

    const integrationsMap = {
      strava: integrations.find(i => i.platform === 'STRAVA') || {
        connected: false,
        connectedAt: null,
        user: null
      },
      polar: integrations.find(i => i.platform === 'POLAR') || {
        connected: false,
        connectedAt: null,
        user: null
      },
      garmin: integrations.find(i => i.platform === 'GARMIN') || {
        connected: false,
        connectedAt: null,
        user: null
      }
    };

    res.json({ integrations: integrationsMap });
  } catch (error) {
    console.error('Get integrations status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/integrations/strava/authorize - Start Strava OAuth flow
router.get('/strava/authorize', authenticate, async (req: any, res) => {
  try {
    if (!STRAVA_CLIENT_ID) {
      return res.status(500).json({ error: 'Strava integration not configured' });
    }

    const authUrl = `${STRAVA_AUTH_URL}?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&approval_prompt=force&scope=read,activity:read_all,activity:write`;

    res.json({ authUrl });
  } catch (error) {
    console.error('Strava authorize error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/integrations/strava/callback - Handle Strava OAuth callback
router.post('/strava/callback', authenticate, async (req: any, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Strava integration not configured' });
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post(STRAVA_TOKEN_URL, {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, athlete } = tokenResponse.data;

    // Save or update integration in database
    await prisma.userIntegration.upsert({
      where: {
        userId_platform: {
          userId: req.userId,
          platform: 'STRAVA',
        },
      },
      update: {
        isConnected: true,
        accessToken: access_token,
        refreshToken: refresh_token,
        lastSync: new Date(),
      },
      create: {
        userId: req.userId,
        platform: 'STRAVA',
        isConnected: true,
        accessToken: access_token,
        refreshToken: refresh_token,
        lastSync: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Strava connected successfully',
      athlete: {
        id: athlete.id,
        username: athlete.username,
        firstname: athlete.firstname,
        lastname: athlete.lastname,
      },
    });
  } catch (error: any) {
    console.error('Strava callback error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to connect Strava',
      details: error.response?.data?.message || error.message
    });
  }
});

// POST /api/integrations/strava/disconnect - Disconnect Strava
router.post('/strava/disconnect', authenticate, async (req: any, res) => {
  try {
    const integration = await prisma.userIntegration.findUnique({
      where: {
        userId_platform: {
          userId: req.userId,
          platform: 'STRAVA',
        },
      },
    });

    if (!integration) {
      return res.status(404).json({ error: 'Strava integration not found' });
    }

    // Revoke Strava access
    if (integration.accessToken) {
      try {
        await axios.post('https://www.strava.com/oauth/deauthorize', {
          access_token: integration.accessToken,
        });
      } catch (error) {
        console.error('Error revoking Strava token:', error);
      }
    }

    // Remove from database
    await prisma.userIntegration.delete({
      where: {
        userId_platform: {
          userId: req.userId,
          platform: 'STRAVA',
        },
      },
    });

    res.json({
      success: true,
      message: 'Strava disconnected successfully',
    });
  } catch (error) {
    console.error('Strava disconnect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/integrations/strava/activities - Get recent Strava activities
router.get('/strava/activities', authenticate, async (req: any, res) => {
  try {
    const integration = await prisma.userIntegration.findUnique({
      where: {
        userId_platform: {
          userId: req.userId,
          platform: 'STRAVA',
        },
      },
    });

    if (!integration || !integration.isConnected || !integration.accessToken) {
      return res.status(404).json({ error: 'Strava not connected' });
    }

    // Get activities from Strava
    const activitiesResponse = await axios.get(`${STRAVA_API_URL}/athlete/activities`, {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
      },
      params: {
        per_page: 30,
      },
    });

    const activities = activitiesResponse.data.map((activity: any) => ({
      id: activity.id,
      name: activity.name,
      type: activity.type,
      distance: activity.distance,
      movingTime: activity.moving_time,
      elapsedTime: activity.elapsed_time,
      totalElevationGain: activity.total_elevation_gain,
      startDate: activity.start_date,
      averageSpeed: activity.average_speed,
      maxSpeed: activity.max_speed,
      averageHeartrate: activity.average_heartrate,
      maxHeartrate: activity.max_heartrate,
    }));

    res.json({ activities });
  } catch (error: any) {
    console.error('Get Strava activities error:', error.response?.data || error.message);

    // If token expired, try to refresh
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Strava token expired',
        message: 'Please reconnect your Strava account'
      });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/integrations/strava/sync - Sync Strava activities to TreinoGO
router.post('/strava/sync', authenticate, async (req: any, res) => {
  try {
    const integration = await prisma.userIntegration.findUnique({
      where: {
        userId_platform: {
          userId: req.userId,
          platform: 'STRAVA',
        },
      },
    });

    if (!integration || !integration.isConnected || !integration.accessToken) {
      return res.status(404).json({ error: 'Strava not connected' });
    }

    // Get user's athlete profile
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { athleteProfile: true },
    });

    if (!user?.athleteProfile) {
      return res.status(404).json({ error: 'Athlete profile not found' });
    }

    // Get activities from Strava
    const activitiesResponse = await axios.get(`${STRAVA_API_URL}/athlete/activities`, {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
      },
      params: {
        per_page: 30,
      },
    });

    const activities = activitiesResponse.data;
    let syncedCount = 0;

    // Import running activities as Activity records
    for (const activity of activities) {
      if (activity.type === 'Run') {
        const distanceKm = (activity.distance / 1000).toFixed(2);
        const timeMinutes = Math.floor(activity.moving_time / 60);
        const paceMinPerKm = activity.distance > 0
          ? Math.floor(activity.moving_time / (activity.distance / 1000) / 60)
          : 0;
        const paceSecPerKm = activity.distance > 0
          ? Math.floor((activity.moving_time / (activity.distance / 1000)) % 60)
          : 0;

        // Check if activity already exists
        const existingActivity = await prisma.activity.findFirst({
          where: {
            athleteId: user.athleteProfile.id,
            createdAt: new Date(activity.start_date),
          },
        });

        if (!existingActivity) {
          await prisma.activity.create({
            data: {
              athleteId: user.athleteProfile.id,
              type: 'Corrida',
              distance: `${distanceKm} km`,
              time: `${timeMinutes} min`,
              pace: `${paceMinPerKm}:${paceSecPerKm.toString().padStart(2, '0')}/km`,
              notes: activity.name,
              createdAt: new Date(activity.start_date),
            },
          });
          syncedCount++;
        }
      }
    }

    // Update last sync time
    await prisma.userIntegration.update({
      where: {
        userId_platform: {
          userId: req.userId,
          platform: 'STRAVA',
        },
      },
      data: {
        lastSync: new Date(),
      },
    });

    res.json({
      success: true,
      message: `Synced ${syncedCount} activities from Strava`,
      syncedCount,
    });
  } catch (error: any) {
    console.error('Sync Strava activities error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Strava token expired',
        message: 'Please reconnect your Strava account'
      });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
