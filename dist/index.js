"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const trainings_1 = __importDefault(require("./routes/trainings"));
const plans_1 = __importDefault(require("./routes/plans"));
const challenges_1 = __importDefault(require("./routes/challenges"));
const physical_tests_1 = __importDefault(require("./routes/physical-tests"));
const races_1 = __importDefault(require("./routes/races"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const feedback_1 = __importDefault(require("./routes/feedback"));
const integrations_1 = __importDefault(require("./routes/integrations"));
const contact_1 = __importDefault(require("./routes/contact"));
const referrals_1 = __importDefault(require("./routes/referrals"));
const subscriptions_1 = __importDefault(require("./routes/subscriptions"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Parse allowed origins from environment variable
const getAllowedOrigins = () => {
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
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin)
            return callback(null, true);
        // If no allowed origins are set, allow all
        if (allowedOrigins.length === 0) {
            return callback(null, true);
        }
        // Check if the origin is in the allowed list
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            // Exact match
            if (origin === allowedOrigin)
                return true;
            // Match without trailing slash
            if (origin === allowedOrigin.replace(/\/$/, ''))
                return true;
            // Match with trailing slash
            if (origin + '/' === allowedOrigin)
                return true;
            return false;
        });
        if (isAllowed) {
            callback(null, true);
        }
        else {
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
app.use(express_1.default.json());
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/trainings', trainings_1.default);
app.use('/api/plans', plans_1.default);
app.use('/api/challenges', challenges_1.default);
app.use('/api/physical-tests', physical_tests_1.default);
app.use('/api/races', races_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/feedback', feedback_1.default);
app.use('/api/integrations', integrations_1.default);
app.use('/api/contact', contact_1.default);
app.use('/api/referrals', referrals_1.default);
app.use('/api/subscriptions', subscriptions_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Treinogo Backend is running!' });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
exports.default = app;
