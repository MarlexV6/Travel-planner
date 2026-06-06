const express = require('express');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleCheck');

const router = express.Router();

// Личная статистика пользователя
router.get('/my', authenticateToken, async (req, res) => {
    try {
        console.log('Fetching stats for user:', req.user.id);
        
        // Получаем количество поездок пользователя
        const totalTrips = await prisma.trip.count({
            where: { user_id: req.user.id }
        });
        
        // Получаем количество точек маршрута пользователя (правильный подсчет)
        const totalPoints = await prisma.tripPoint.count({
            where: {
                trip: {
                    user_id: req.user.id
                }
            }
        });
        
        // Для отладки
        console.log(`User ${req.user.id}: ${totalTrips} trips, ${totalPoints} points`);
        
        // Среднее количество точек на поездку
        const averagePointsPerTrip = totalTrips > 0 
            ? (totalPoints / totalTrips).toFixed(1) 
            : 0;
        
        // Самая длительная поездка
        const longestTripResult = await prisma.$queryRaw`
            SELECT 
                title,
                (end_date - start_date) as duration_days
            FROM trips
            WHERE user_id = ${req.user.id}
                AND end_date IS NOT NULL 
                AND start_date IS NOT NULL
                AND end_date >= start_date
            ORDER BY (end_date - start_date) DESC
            LIMIT 1
        `;
        
        const longestTrip = longestTripResult && longestTripResult[0] && longestTripResult[0].duration_days ? {
            title: longestTripResult[0].title,
            duration_days: parseInt(longestTripResult[0].duration_days)
        } : null;
        
        // Предстоящие поездки
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingTrips = await prisma.trip.count({
            where: {
                user_id: req.user.id,
                start_date: {
                    gte: today
                }
            }
        });
        
        // Статистика по месяцам
        const tripsByMonth = await prisma.$queryRaw`
            SELECT 
                TO_CHAR(DATE_TRUNC('month', start_date), 'YYYY-MM') as month,
                COUNT(*)::int as count
            FROM trips
            WHERE user_id = ${req.user.id}
                AND start_date IS NOT NULL
            GROUP BY DATE_TRUNC('month', start_date)
            ORDER BY month DESC
            LIMIT 6
        `;
        
        // Получаем список всех поездок с количеством точек для детальной проверки
        const tripsWithPoints = await prisma.$queryRaw`
            SELECT 
                t.id,
                t.title,
                COUNT(tp.id)::int as points_count
            FROM trips t
            LEFT JOIN trip_points tp ON t.id = tp.trip_id
            WHERE t.user_id = ${req.user.id}
            GROUP BY t.id, t.title
            ORDER BY t.start_date DESC
        `;
        
        res.json({
            total_trips: totalTrips,
            total_points: totalPoints,
            average_points_per_trip: parseFloat(averagePointsPerTrip),
            upcoming_trips: upcomingTrips,
            longest_trip: longestTrip,
            trips_by_month: tripsByMonth || [],
            trips_with_points: tripsWithPoints // для отладки
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Общая статистика (только admin)
router.get('/admin', authenticateToken, allowRoles('admin'), async (req, res) => {
    try {
        console.log('Fetching admin stats');
        
        // Основная статистика
        const userCount = await prisma.user.count();
        const tripCount = await prisma.trip.count();
        const pointCount = await prisma.tripPoint.count();
        
        console.log(`Admin stats: ${userCount} users, ${tripCount} trips, ${pointCount} points`);
        
        // Статистика по ролям
        const usersByRole = await prisma.user.groupBy({
            by: ['role'],
            _count: {
                role: true
            }
        });
        
        // Топ пользователей по количеству поездок и точек
        const topUsers = await prisma.$queryRaw`
            SELECT 
                u.username,
                u.role,
                COUNT(DISTINCT t.id)::int as trip_count,
                COUNT(tp.id)::int as point_count
            FROM users u
            LEFT JOIN trips t ON u.id = t.user_id
            LEFT JOIN trip_points tp ON t.id = tp.trip_id
            GROUP BY u.id, u.username, u.role
            ORDER BY trip_count DESC
            LIMIT 10
        `;
        
        // Статистика по дням недели
        const tripsByWeekday = await prisma.$queryRaw`
            SELECT 
                EXTRACT(DOW FROM start_date)::int as weekday,
                COUNT(*)::int as count
            FROM trips
            WHERE start_date IS NOT NULL
            GROUP BY EXTRACT(DOW FROM start_date)
            ORDER BY weekday
        `;
        
        // Активность за последние 30 дней
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const tripsCreated = await prisma.trip.count({
            where: {
                created_at: {
                    gte: thirtyDaysAgo
                }
            }
        });
        
        const usersRegistered = await prisma.user.count({
            where: {
                created_at: {
                    gte: thirtyDaysAgo
                }
            }
        });
        
        const pointsAdded = await prisma.tripPoint.count({
            where: {
                created_at: {
                    gte: thirtyDaysAgo
                }
            }
        });
        
        // Дополнительная статистика: распределение точек по поездкам
        const pointsDistribution = await prisma.$queryRaw`
            SELECT 
                COUNT(tp.id)::int as points_in_trip,
                COUNT(DISTINCT t.id)::int as trips_count
            FROM trips t
            LEFT JOIN trip_points tp ON t.id = tp.trip_id
            GROUP BY t.id
        `;
        
        const weekdayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        const formattedWeekdays = (tripsByWeekday || []).map(item => ({
            weekday: weekdayNames[item.weekday] || item.weekday,
            count: item.count
        }));
        
        res.json({
            overview: {
                total_users: userCount,
                total_trips: tripCount,
                total_points: pointCount,
                average_trips_per_user: userCount > 0 ? parseFloat((tripCount / userCount).toFixed(1)) : 0,
                average_points_per_trip: tripCount > 0 ? parseFloat((pointCount / tripCount).toFixed(1)) : 0,
                average_points_per_user: userCount > 0 ? parseFloat((pointCount / userCount).toFixed(1)) : 0
            },
            users_by_role: usersByRole,
            top_users: topUsers,
            trips_by_weekday: formattedWeekdays,
            recent_activity: {
                trips_created_last_30_days: tripsCreated,
                users_registered_last_30_days: usersRegistered,
                points_added_last_30_days: pointsAdded
            }
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;