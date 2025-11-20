import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import trainingRoutes from './routes/trainings';
import planRoutes from './routes/plans';
import challengeRoutes from './routes/challenges';
import physicalTestRoutes from './routes/physical-tests';
import raceRoutes from './routes/races';
import dashboardRoutes from './routes/dashboard';
import notificationRoutes from './routes/notifications';
import feedbackRoutes from './routes/feedback';
import integrationsRoutes from './routes/integrations';
import contactRoutes from './routes/contact';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Parse allowed origins from environment variable
const getAllowedOrigins = (): string[] => {
  const origins = process.env.ALLOWED_ORIGINS;
  if (!origins) {
    console.warn('⚠️  ALLOWED_ORIGINS not set, allowing all origins');
    return [];
  }
  
  // Split by comma and trim whitespace, remove trailing slashes
  const parsedOrigins = origins
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(origin => origin.length > 0);
  
  console.log('🌍 Allowed origins:', parsedOrigins);
  return parsedOrigins;
};

const allowedOrigins = getAllowedOrigins();

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // If no allowed origins are set, allow all
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }
    
    // Check if the origin is in the allowed list
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Exact match
      if (origin === allowedOrigin) return true;
      // Match without trailing slash
      if (origin === allowedOrigin.replace(/\/$/, '')) return true;
      // Match with trailing slash
      if (origin + '/' === allowedOrigin) return true;
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
}));
// Debug middleware to log requests
app.use((req, res, next) => {
  const origin = req.get('Origin') || req.get('Referer') || 'No origin';
  console.log(`📥 ${req.method} ${req.path} - Origin: ${origin}`);
  next();
});

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/physical-tests', physicalTestRoutes);
app.use('/api/races', raceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/contact', contactRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Treinogo Backend is running!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;