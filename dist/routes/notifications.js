"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get notifications for user
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { limit = '20', unreadOnly = 'false' } = req.query;
        const whereClause = {
            userId: req.userId
        };
        if (unreadOnly === 'true') {
            whereClause.isRead = false;
        }
        const notifications = await prisma_1.prisma.notification.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        });
        res.json({ notifications });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get unread count
router.get('/unread-count', auth_1.authenticate, async (req, res) => {
    try {
        const count = await prisma_1.prisma.notification.count({
            where: {
                userId: req.userId,
                isRead: false
            }
        });
        res.json({ count });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark notification as read
router.put('/:id/read', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await prisma_1.prisma.notification.findUnique({
            where: { id }
        });
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        if (notification.userId !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        await prisma_1.prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json({ message: 'Notification marked as read' });
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark all notifications as read
router.put('/mark-all-read', auth_1.authenticate, async (req, res) => {
    try {
        await prisma_1.prisma.notification.updateMany({
            where: {
                userId: req.userId,
                isRead: false
            },
            data: { isRead: true }
        });
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create notification (for system use)
async function createNotification(userId, title, message, type = 'INFO') {
    try {
        await prisma_1.prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type
            }
        });
    }
    catch (error) {
        console.error('Create notification error:', error);
    }
}
exports.default = router;
