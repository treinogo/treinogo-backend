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
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middlewares
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173']
}));
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
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Treinogo Backend is running!' });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
exports.default = app;
