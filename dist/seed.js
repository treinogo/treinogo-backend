"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("./lib/prisma");
async function seed() {
    try {
        // Clear existing data in correct order
        await prisma_1.prisma.challengeParticipant.deleteMany();
        await prisma_1.prisma.training.deleteMany();
        await prisma_1.prisma.physicalTest.deleteMany();
        await prisma_1.prisma.race.deleteMany();
        await prisma_1.prisma.challenge.deleteMany();
        await prisma_1.prisma.trainingPlan.deleteMany();
        await prisma_1.prisma.athleteProfile.deleteMany();
        await prisma_1.prisma.coachProfile.deleteMany();
        await prisma_1.prisma.user.deleteMany();
        // Create a coach
        const hashedPassword = await bcryptjs_1.default.hash('123456', 12);
        const coach = await prisma_1.prisma.user.create({
            data: {
                email: 'coach@treinogo.com',
                password: hashedPassword,
                name: 'Coach Professional',
                role: 'COACH'
            }
        });
        const coachProfile = await prisma_1.prisma.coachProfile.create({
            data: { userId: coach.id }
        });
        // Create athletes
        const athletes = [
            {
                email: 'joao@email.com',
                name: 'João Silva',
                phone: '(11) 99999-1111',
                age: 28,
                level: 'BEGINNER'
            },
            {
                email: 'maria@email.com',
                name: 'Maria Santos',
                phone: '(11) 99999-2222',
                age: 32,
                level: 'INTERMEDIATE'
            },
            {
                email: 'pedro@email.com',
                name: 'Pedro Costa',
                phone: '(11) 99999-3333',
                age: 24,
                level: 'ADVANCED'
            },
            {
                email: 'ana@email.com',
                name: 'Ana Oliveira',
                phone: '(11) 99999-4444',
                age: 35,
                level: 'INTERMEDIATE'
            }
        ];
        for (const athleteData of athletes) {
            const user = await prisma_1.prisma.user.create({
                data: {
                    email: athleteData.email,
                    password: hashedPassword,
                    name: athleteData.name,
                    phone: athleteData.phone,
                    age: athleteData.age,
                    role: 'ATHLETE'
                }
            });
            await prisma_1.prisma.athleteProfile.create({
                data: {
                    userId: user.id,
                    level: athleteData.level,
                    status: 'ACTIVE',
                    coachId: coachProfile.id,
                    completedTrainings: Math.floor(Math.random() * 50),
                    currentProgress: Math.floor(Math.random() * 100),
                    averageTime: `${Math.floor(Math.random() * 30) + 25}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
                    averagePace: `${Math.floor(Math.random() * 2) + 4}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`
                }
            });
        }
        console.log('✅ Seed completed successfully!');
        console.log('Coach login: coach@treinogo.com / 123456');
    }
    catch (error) {
        console.error('❌ Seed failed:', error);
    }
    finally {
        await prisma_1.prisma.$disconnect();
    }
}
seed();
