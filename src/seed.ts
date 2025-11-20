import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';

async function seed() {
  try {
    // Clear existing data in correct order
    await prisma.challengeParticipant.deleteMany();
    await prisma.training.deleteMany();
    await prisma.physicalTest.deleteMany();
    await prisma.race.deleteMany();
    await prisma.challenge.deleteMany();
    await prisma.trainingPlan.deleteMany();
    await prisma.athleteProfile.deleteMany();
    await prisma.coachProfile.deleteMany();
    await prisma.user.deleteMany();

    // Create a coach
    const hashedPassword = await bcrypt.hash('123456', 12);
    
    const coach = await prisma.user.create({
      data: {
        email: 'coach@treinogo.com',
        password: hashedPassword,
        name: 'Coach Professional',
        role: 'COACH'
      }
    });

    const coachProfile = await prisma.coachProfile.create({
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
      const user = await prisma.user.create({
        data: {
          email: athleteData.email,
          password: hashedPassword,
          name: athleteData.name,
          phone: athleteData.phone,
          age: athleteData.age,
          role: 'ATHLETE'
        }
      });

      await prisma.athleteProfile.create({
        data: {
          userId: user.id,
          level: athleteData.level as any,
          status: 'ACTIVE',
          coachId: coachProfile.id,
          completedTrainings: Math.floor(Math.random() * 50),
          currentProgress: Math.floor(Math.random() * 100),
          averageTime: `${Math.floor(Math.random() * 30) + 25}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
          averagePace: `${Math.floor(Math.random() * 2) + 4}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`
        }
      });
    }

    // Get created athlete profiles
    const athleteProfiles = await prisma.athleteProfile.findMany({
      where: { coachId: coachProfile.id }
    });

    // Create Training Plans with Weekly Programming
    type WeekData = {
      week: number;
      monday?: string;
      tuesday?: string;
      wednesday?: string;
      thursday?: string;
      friday?: string;
      saturday?: string;
      sunday?: string;
    };

    const plans: Array<{
      name: string;
      category: string;
      duration: number;
      daysPerWeek: number;
      weeks: WeekData[];
    }> = [
      {
        name: '5K para Iniciantes',
        category: 'FIVE_K',
        duration: 8,
        daysPerWeek: 3,
        weeks: [
          {
            week: 1,
            monday: JSON.stringify({ tipo: 'Corrida Contínua', distancia: '3km', tempo: '20:00', pace: '6:30', observacoes: 'Ritmo leve' }),
            wednesday: JSON.stringify({ tipo: 'Intervalado', distancia: '4km', tempo: '25:00', pace: '6:00', observacoes: '5x400m com 1min descanso' }),
            friday: JSON.stringify({ tipo: 'Corrida Contínua', distancia: '3km', tempo: '19:00', pace: '6:20', observacoes: 'Ritmo confortável' })
          },
          {
            week: 2,
            monday: JSON.stringify({ tipo: 'Corrida Contínua', distancia: '4km', tempo: '26:00', pace: '6:30', observacoes: 'Ritmo leve' }),
            wednesday: JSON.stringify({ tipo: 'Intervalado', distancia: '4km', tempo: '24:00', pace: '5:50', observacoes: '6x400m com 1min descanso' }),
            friday: JSON.stringify({ tipo: 'Corrida Contínua', distancia: '4km', tempo: '25:00', pace: '6:15', observacoes: 'Ritmo confortável' })
          }
        ]
      },
      {
        name: '10K Intermediário',
        category: 'TEN_K',
        duration: 12,
        daysPerWeek: 4,
        weeks: [
          {
            week: 1,
            tuesday: JSON.stringify({ tipo: 'Corrida Contínua', distancia: '6km', tempo: '36:00', pace: '6:00', observacoes: 'Ritmo moderado' }),
            wednesday: JSON.stringify({ tipo: 'Intervalado', distancia: '8km', tempo: '42:00', pace: '5:15', observacoes: '8x800m com 90s descanso' }),
            friday: JSON.stringify({ tipo: 'Fartlek', distancia: '7km', tempo: '38:00', pace: '5:25', observacoes: 'Variações de ritmo' }),
            sunday: JSON.stringify({ tipo: 'Longão', distancia: '12km', tempo: '1:12:00', pace: '6:00', observacoes: 'Ritmo confortável' })
          }
        ]
      },
      {
        name: 'Meia Maratona Avançado',
        category: 'HALF_MARATHON',
        duration: 16,
        daysPerWeek: 5,
        weeks: [
          {
            week: 1,
            monday: JSON.stringify({ tipo: 'Corrida Contínua', distancia: '8km', tempo: '44:00', pace: '5:30', observacoes: 'Ritmo regenerativo' }),
            tuesday: JSON.stringify({ tipo: 'Intervalado', distancia: '12km', tempo: '1:00:00', pace: '5:00', observacoes: '10x1000m com 2min descanso' }),
            thursday: JSON.stringify({ tipo: 'Fartlek', distancia: '10km', tempo: '52:00', pace: '5:12', observacoes: 'Fartlek progressivo' }),
            saturday: JSON.stringify({ tipo: 'Corrida Contínua', distancia: '15km', tempo: '1:22:30', pace: '5:30', observacoes: 'Ritmo moderado' }),
            sunday: JSON.stringify({ tipo: 'Longão', distancia: '20km', tempo: '1:55:00', pace: '5:45', observacoes: 'Long run base' })
          }
        ]
      }
    ];

    const createdPlans = [];
    for (const planData of plans) {
      const plan = await prisma.trainingPlan.create({
        data: {
          name: planData.name,
          category: planData.category as any,
          duration: planData.duration,
          daysPerWeek: planData.daysPerWeek,
          status: 'ACTIVE',
          createdById: coachProfile.id
        }
      });
      createdPlans.push(plan);

      // Create weekly programming
      for (const weekData of planData.weeks) {
        await prisma.weeklyProgramming.create({
          data: {
            planId: plan.id,
            week: weekData.week,
            monday: weekData.monday || null,
            tuesday: weekData.tuesday || null,
            wednesday: weekData.wednesday || null,
            thursday: weekData.thursday || null,
            friday: weekData.friday || null,
            saturday: weekData.saturday || null,
            sunday: weekData.sunday || null
          }
        });
      }
    }

    // Assign plans to athletes
    await prisma.athleteProfile.update({
      where: { id: athleteProfiles[0].id },
      data: { currentPlanId: createdPlans[0].id }
    });
    await prisma.athleteProfile.update({
      where: { id: athleteProfiles[1].id },
      data: { currentPlanId: createdPlans[1].id }
    });
    await prisma.athleteProfile.update({
      where: { id: athleteProfiles[2].id },
      data: { currentPlanId: createdPlans[2].id }
    });

    // Create Training sessions for athletes
    const today = new Date();
    for (let i = 0; i < athleteProfiles.length; i++) {
      const athlete = athleteProfiles[i];

      // Create past trainings (last 30 days)
      for (let day = 30; day >= 0; day -= 3) {
        const trainingDate = new Date(today);
        trainingDate.setDate(today.getDate() - day);

        await prisma.training.create({
          data: {
            date: trainingDate,
            type: ['CONTINUOUS_RUN', 'INTERVAL_TRAINING', 'LONG_RUN', 'FARTLEK'][Math.floor(Math.random() * 4)] as any,
            distance: `${Math.floor(Math.random() * 10) + 3}km`,
            duration: `${Math.floor(Math.random() * 40) + 20}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
            pace: `${Math.floor(Math.random() * 2) + 5}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
            notes: 'Treino concluído com sucesso',
            status: 'COMPLETED',
            athleteId: athlete.id,
            planId: i < createdPlans.length ? createdPlans[i].id : null
          }
        });
      }

      // Create future trainings
      for (let day = 1; day <= 7; day++) {
        const trainingDate = new Date(today);
        trainingDate.setDate(today.getDate() + day);

        await prisma.training.create({
          data: {
            date: trainingDate,
            type: ['CONTINUOUS_RUN', 'INTERVAL_TRAINING', 'RECOVERY_RUN'][Math.floor(Math.random() * 3)] as any,
            distance: `${Math.floor(Math.random() * 8) + 4}km`,
            duration: `${Math.floor(Math.random() * 30) + 25}:00`,
            pace: `${Math.floor(Math.random() * 2) + 5}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
            notes: 'Treino planejado',
            status: 'PENDING',
            athleteId: athlete.id,
            planId: i < createdPlans.length ? createdPlans[i].id : null
          }
        });
      }
    }

    // Create Challenges
    const challenges = [
      {
        name: 'Desafio 100km Novembro',
        objective: 'Completar 100km no mês de novembro',
        duration: 30,
        startDate: new Date('2025-11-01'),
        endDate: new Date('2025-11-30'),
        reward: 'Medalha virtual + desconto de 20% na mensalidade'
      },
      {
        name: 'Corrida dos 21 Dias',
        objective: 'Correr pelo menos 5km por dia durante 21 dias consecutivos',
        duration: 21,
        startDate: new Date(today.getFullYear(), today.getMonth(), 1),
        endDate: new Date(today.getFullYear(), today.getMonth(), 21),
        reward: 'Certificado de conclusão'
      },
      {
        name: 'Maratona de Ritmo',
        objective: 'Melhorar o pace médio em 30 segundos em 45 dias',
        duration: 45,
        startDate: today,
        endDate: new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000),
        reward: 'Plano personalizado gratuito'
      }
    ];

    for (const challengeData of challenges) {
      const challenge = await prisma.challenge.create({
        data: {
          ...challengeData,
          status: 'ACTIVE',
          createdById: coachProfile.id
        }
      });

      // Add participants
      for (const athlete of athleteProfiles.slice(0, 3)) {
        await prisma.challengeParticipant.create({
          data: {
            challengeId: challenge.id,
            athleteId: athlete.id,
            progress: Math.floor(Math.random() * 80),
            points: Math.floor(Math.random() * 500)
          }
        });
      }
    }

    // Create Races
    const races = [
      {
        name: 'Corrida de São Silvestre',
        distances: ['15km'],
        city: 'São Paulo',
        state: 'SP',
        raceDate: new Date('2025-12-31'),
        timeOfDay: 'MORNING',
        link: 'https://saosilvestre.com.br'
      },
      {
        name: 'Meia Maratona do Rio',
        distances: ['5km', '10km', '21km'],
        city: 'Rio de Janeiro',
        state: 'RJ',
        raceDate: new Date('2025-08-15'),
        timeOfDay: 'MORNING',
        link: 'https://meiamaratonadorio.com.br'
      },
      {
        name: 'Maratona de Porto Alegre',
        distances: ['5km', '10km', '21km', '42km'],
        city: 'Porto Alegre',
        state: 'RS',
        raceDate: new Date('2025-06-20'),
        timeOfDay: 'MORNING',
        link: 'https://maratonapoa.com.br'
      },
      {
        name: 'Night Run Curitiba',
        distances: ['5km', '10km'],
        city: 'Curitiba',
        state: 'PR',
        raceDate: new Date('2025-09-10'),
        timeOfDay: 'EVENING',
        link: 'https://nightruncuritiba.com.br'
      }
    ];

    for (const raceData of races) {
      await prisma.race.create({
        data: {
          ...raceData,
          timeOfDay: raceData.timeOfDay as any,
          createdById: coachProfile.id
        }
      });
    }

    // Create Physical Tests
    const testTypes = ['TWELVE_MINUTES', 'THREE_KM', 'FIVE_KM'];
    for (let i = 0; i < athleteProfiles.length; i++) {
      const athlete = athleteProfiles[i];

      // Create 2-3 tests per athlete
      for (let t = 0; t < 2; t++) {
        const testDate = new Date(today);
        testDate.setDate(today.getDate() - (t * 30 + Math.floor(Math.random() * 10)));

        const testType = testTypes[t % testTypes.length] as any;
        let pace, finalTime, distance;

        if (testType === 'TWELVE_MINUTES') {
          distance = 2.5 + Math.random() * 0.8; // 2.5km - 3.3km
          pace = '4:50';
          finalTime = '12:00';
        } else if (testType === 'THREE_KM') {
          finalTime = `${13 + Math.floor(Math.random() * 3)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
          pace = '4:40';
          distance = 3.0;
        } else {
          finalTime = `${22 + Math.floor(Math.random() * 5)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;
          pace = '4:50';
          distance = 5.0;
        }

        await prisma.physicalTest.create({
          data: {
            athleteId: athlete.id,
            testType,
            pace,
            finalTime,
            distance,
            testDate
          }
        });
      }
    }

    console.log('✅ Seed completed successfully!');
    console.log('📊 Created:');
    console.log(`   - 1 Coach (coach@treinogo.com / 123456)`);
    console.log(`   - ${athleteProfiles.length} Athletes`);
    console.log(`   - ${createdPlans.length} Training Plans with Weekly Programming`);
    console.log(`   - ${challenges.length} Active Challenges`);
    console.log(`   - ${races.length} Races`);
    console.log(`   - Multiple Physical Tests`);
    console.log(`   - Training sessions (past and future)`);
    console.log('\n🎯 Now you can test all features in the dashboard!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();