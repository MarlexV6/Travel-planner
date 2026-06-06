const express = require('express');
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { geocodeAddress } = require('../services/geocoding');
const { optimizeRoute, calculateTotalDistance } = require('../services/routeOptimizer');
const routing = require('../services/routing');
const { getNearestPort } = require('../services/placesService');
const axios = require('axios');

const router = express.Router();

// Получить ВСЕ поездки (для админа) или только свои (для пользователя)
router.get('/', authenticateToken, async (req, res) => {
    try {
        let trips;
        if (req.user.role === 'admin') {
            trips = await prisma.trip.findMany({
                include: { 
                    user: { 
                        select: { 
                            id: true,
                            username: true, 
                            email: true 
                        } 
                    } 
                },
                orderBy: { start_date: 'asc' }
            });
        } else {
            trips = await prisma.trip.findMany({
                where: { user_id: req.user.id },
                orderBy: { start_date: 'asc' }
            });
        }
        res.json(trips);
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ error: error.message });
    }
});

// Проверка конфликта дат
router.post('/:tripId/check-dates', authenticateToken, async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const { start_date, end_date } = req.body;
    
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    const points = await prisma.tripPoint.findMany({
      where: { 
        trip_id: tripId,
        day: {
          date: {
            not: null
          }
        }
      },
      include: { day: true }
    });
    
    const conflictingPoints = points.filter(point => {
      const pointDate = new Date(point.day?.date);
      return pointDate < startDate || pointDate > endDate;
    }).map(p => ({
      id: p.id,
      place_name: p.place_name,
      issue: p.day?.date < startDate ? 'До начала поездки' : 'После окончания поездки'
    }));
    
    res.json({ hasConflict: conflictingPoints.length > 0, points: conflictingPoints });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Перенос точек на новые даты
router.post('/:tripId/move-points', authenticateToken, async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const { start_date, end_date } = req.body;
    
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const daysCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    const points = await prisma.tripPoint.findMany({
      where: { trip_id: tripId },
      include: { day: true }
    });
    
    for (const point of points) {
      if (point.day) {
        const oldDate = new Date(point.day.date);
        const dayNumber = point.day.day_number;
        
        let newDayNumber = dayNumber;
        if (oldDate < startDate) {
          newDayNumber = 1;
        } else if (oldDate > endDate) {
          newDayNumber = daysCount;
        }
        
        const newDay = await prisma.tripDay.findFirst({
          where: { trip_id: tripId, day_number: newDayNumber }
        });
        
        if (newDay && newDay.id !== point.day_id) {
          await prisma.tripPoint.update({
            where: { id: point.id },
            data: { day_id: newDay.id }
          });
        }
      }
    }
    
    res.json({ message: 'Points moved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать поездку (POST /api/trips)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, start_date, end_date } = req.body;
        
        console.log('Creating trip for user:', req.user.id);
        console.log('Trip data:', { title, start_date, end_date });
        
        if (!title || !start_date || !end_date) {
            return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
        }
        
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (endDate < startDate) {
            return res.status(400).json({ error: 'Дата окончания не может быть раньше даты начала' });
        }
        
        if (startDate < today) {
            return res.status(400).json({ error: 'Дата начала не может быть в прошлом' });
        }
        
        const existingTrips = await prisma.trip.findMany({
            where: {
                user_id: req.user.id,
                OR: [
                    {
                        AND: [
                            { start_date: { lte: endDate } },
                            { end_date: { gte: startDate } }
                        ]
                    }
                ]
            }
        });
        
        if (existingTrips.length > 0) {
            const conflict = existingTrips[0];
            return res.status(409).json({
                error: 'conflict',
                message: `Даты пересекаются с поездкой "${conflict.title}"`,
                conflictingTrip: {
                    id: conflict.id,
                    title: conflict.title,
                    start_date: conflict.start_date,
                    end_date: conflict.end_date
                }
            });
        }
        
        const trip = await prisma.trip.create({
            data: {
                user_id: req.user.id,
                title: title.trim(),
                start_date: startDate,
                end_date: endDate
            }
        });
        
        console.log('Trip created:', trip.id);
        res.status(201).json(trip);
        
    } catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить ТОЛЬКО свои поездки (для админа)
router.get('/my-only', authenticateToken, async (req, res) => {
    try {
        const trips = await prisma.trip.findMany({
            where: { user_id: req.user.id },
            orderBy: { start_date: 'asc' }
        });
        res.json(trips);
    } catch (error) {
        console.error('Error fetching my-only trips:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить одну поездку
router.get('/:tripId', authenticateToken, async (req, res) => {
    try {
        const tripId = parseInt(req.params.tripId);
        console.log('Fetching trip:', tripId, 'User:', req.user.id, 'Role:', req.user.role);
        
        let trip;
        if (req.user.role === 'admin') {
            trip = await prisma.trip.findUnique({
                where: { id: tripId },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    }
                }
            });
        } else {
            trip = await prisma.trip.findFirst({
                where: {
                    id: tripId,
                    user_id: req.user.id
                }
            });
        }
        
        if (!trip) {
            console.log('Trip not found:', tripId);
            return res.status(404).json({ error: 'Поездка не найдена' });
        }
        
        console.log('Trip found:', { id: trip.id, title: trip.title, start_date: trip.start_date, end_date: trip.end_date });
        res.json(trip);
    } catch (error) {
        console.error('Error fetching trip:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить детали поездки с маршрутом
router.get('/:tripId/details', authenticateToken, async (req, res) => {
    try {
        const tripId = parseInt(req.params.tripId);
        console.log('Fetching trip details:', tripId, 'User:', req.user.id, 'Role:', req.user.role);
        
        let trip;
        if (req.user.role === 'admin') {
            trip = await prisma.trip.findUnique({
                where: { id: tripId },
                include: {
                    points: {
                        orderBy: { order_index: 'asc' }
                    },
                    user: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                }
            });
        } else {
            trip = await prisma.trip.findFirst({
                where: {
                    id: tripId,
                    user_id: req.user.id
                },
                include: {
                    points: {
                        orderBy: { order_index: 'asc' }
                    }
                }
            });
        }
        
        if (!trip) {
            console.log('Trip not found:', tripId);
            return res.status(404).json({ error: 'Поездка не найдена' });
        }
        
        console.log('Trip details found, points:', trip.points?.length || 0);
        res.json(trip);
    } catch (error) {
        console.error('Error fetching trip details:', error);
        res.status(500).json({ error: error.message });
    }
});

// Оптимизировать порядок точек маршрута
router.post('/:tripId/optimize', authenticateToken, async (req, res) => {
    try {
        const tripId = parseInt(req.params.tripId);
        
        const points = await prisma.tripPoint.findMany({
            where: { trip_id: tripId },
            orderBy: { order_index: 'asc' }
        });
        
        if (points.length < 3) {
            return res.status(400).json({ error: 'Для оптимизации нужно минимум 3 точки' });
        }
        
        const currentOrderIds = points.map(p => p.id);
        const optimizedPoints = optimizeRoute(points);
        const newOrderIds = optimizedPoints.map(p => p.id);
        
        let orderChanged = false;
        for (let i = 0; i < currentOrderIds.length; i++) {
            if (currentOrderIds[i] !== newOrderIds[i]) {
                orderChanged = true;
                break;
            }
        }
        
        const oldDistance = calculateTotalDistance(points);
        const newDistance = calculateTotalDistance(optimizedPoints);
        
        let improvement = 0;
        if (oldDistance > 0) {
            improvement = ((oldDistance - newDistance) / oldDistance * 100);
        }
        
        if (!orderChanged || improvement < 0.1) {
            return res.json({
                message: 'Маршрут уже оптимален',
                old_order: points.map(p => p.place_name),
                new_order: points.map(p => p.place_name),
                old_distance: oldDistance.toFixed(1),
                new_distance: oldDistance.toFixed(1),
                improvement: 0,
                already_optimal: true
            });
        }
        
        for (let i = 0; i < optimizedPoints.length; i++) {
            await prisma.tripPoint.update({
                where: { id: optimizedPoints[i].id },
                data: { order_index: i }
            });
        }
        
        res.json({
            message: 'Маршрут оптимизирован',
            old_order: points.map(p => p.place_name),
            new_order: optimizedPoints.map(p => p.place_name),
            old_distance: oldDistance.toFixed(1),
            new_distance: newDistance.toFixed(1),
            improvement: improvement.toFixed(1),
            first_point_preserved: true,
            already_optimal: false
        });
    } catch (error) {
        console.error('Error optimizing route:', error);
        res.status(500).json({ error: error.message });
    }
});

// Обновить поездку (даты, название)
router.put('/:tripId', authenticateToken, async (req, res) => {
    try {
        const tripId = parseInt(req.params.tripId);
        const { title, start_date, end_date } = req.body;
        
        const trip = await prisma.trip.findUnique({
            where: { id: tripId },
            include: { points: true }
        });
        
        if (!trip) {
            return res.status(404).json({ error: 'Поездка не найдена' });
        }
        
        if (req.user.role !== 'admin' && trip.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Нет прав на редактирование' });
        }
        
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (startDate < today) {
            return res.status(400).json({ error: 'Дата начала не может быть в прошлом' });
        }
        
        if (endDate < startDate) {
            return res.status(400).json({ error: 'Дата окончания не может быть раньше даты начала' });
        }
        
        // Проверка пересечения с другими поездками
        const conflictingTrips = await prisma.trip.findMany({
            where: {
                user_id: req.user.id,
                id: { not: tripId },
                OR: [
                    {
                        AND: [
                            { start_date: { lte: endDate } },
                            { end_date: { gte: startDate } }
                        ]
                    }
                ]
            }
        });
        
        if (conflictingTrips.length > 0) {
            const conflict = conflictingTrips[0];
            return res.status(409).json({
                error: 'conflict',
                message: `Даты пересекаются с поездкой "${conflict.title}"`,
                conflict: {
                    id: conflict.id,
                    title: conflict.title,
                    start_date: conflict.start_date,
                    end_date: conflict.end_date
                }
            });
        }
        
        // Обновляем поездку
        const updatedTrip = await prisma.trip.update({
            where: { id: tripId },
            data: { 
                title: title?.trim(), 
                start_date: startDate, 
                end_date: endDate 
            }
        });
        
        // Проверяем точки, выходящие за пределы новых дат
        const unavailableDates = [];
        for (const point of trip.points) {
            if (point.created_at) {
                const pointDate = new Date(point.created_at);
                if (pointDate < startDate || pointDate > endDate) {
                    unavailableDates.push({
                        point_name: point.place_name,
                        date: point.created_at,
                        issue: pointDate < startDate ? 'До начала поездки' : 'После окончания поездки'
                    });
                }
            }
        }
        
        res.json({
            message: 'Поездка обновлена',
            trip: updatedTrip,
            unavailableDates: unavailableDates.length > 0 ? unavailableDates : null
        });
    } catch (error) {
        console.error('Error updating trip:', error);
        res.status(500).json({ error: error.message });
    }
});

// Удалить поездку
router.delete('/:tripId', authenticateToken, async (req, res) => {
    try {
        const tripId = parseInt(req.params.tripId);
        
        const trip = await prisma.trip.findUnique({
            where: { id: tripId }
        });
        
        if (!trip) {
            return res.status(404).json({ error: 'Поездка не найдена' });
        }
        
        if (req.user.role !== 'admin' && trip.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Нет прав на удаление этой поездки' });
        }
        
        await prisma.trip.delete({
            where: { id: tripId }
        });
        
        res.json({ message: 'Поездка удалена' });
    } catch (error) {
        console.error('Error deleting trip:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить маршрут
router.post('/:tripId/route', authenticateToken, async (req, res) => {
    try {
        const tripId = parseInt(req.params.tripId);
        const points = await prisma.tripPoint.findMany({
            where: { trip_id: tripId },
            orderBy: { order_index: 'asc' }
        });
        
        if (points.length < 2) {
            return res.json({ 
                polyline: [],
                distance: null,
                duration: null,
                error: 'Недостаточно точек для построения маршрута'
            });
        }
        
        // Build route segment by segment to detect impossible segments
        const fullPolyline = [];
        let totalDistance = 0;
        let totalDuration = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i+1];
            const startLat = parseFloat(a.latitude);
            const startLon = parseFloat(a.longitude);
            const endLat = parseFloat(b.latitude);
            const endLon = parseFloat(b.longitude);

            // Try driving route first
            let segmentRoute = null;
            try {
                segmentRoute = await routing.getRoute(startLat, startLon, endLat, endLon, 'driving');
            } catch (e) {
                segmentRoute = null;
            }

            if (!segmentRoute) {
                // Try multimodal options (ferry/flight)
                try {
                    const multi = await routing.getMultiModalRoute(startLat, startLon, endLat, endLon);
                    if (multi && multi.length > 0) {
                        segmentRoute = multi[0];
                    }
                } catch (e) {
                    segmentRoute = null;
                }
            }

            if (!segmentRoute) {
                // No route found - first try to suggest flight (nearest airport), then water port
                try {
                    const flightSuggestion = await routing.checkFlightAvailability(startLat, startLon, endLat, endLon);
                    if (flightSuggestion && flightSuggestion.available && flightSuggestion.airport) {
                        return res.json({
                            route_possible: false,
                            suggestion: {
                                type: 'redirect_to_airport',
                                segment_index: i,
                                airport: flightSuggestion.airport,
                                message: 'Нет дорожного маршрута. Предлагается доставить пассажиров к ближайшему аэропорту.'
                            }
                        });
                    }
                } catch (e) {
                    console.error('Flight suggestion error:', e.message);
                }

                // Suggest nearest ports (origin and destination)
                const originPort = await getNearestPort(startLat, startLon);
                const destPort = await getNearestPort(endLat, endLon);
                if (originPort && destPort) {
                    return res.json({
                        route_possible: false,
                        suggestion: {
                            type: 'redirect_ports_pair',
                            segment_index: i,
                            origin_port: originPort,
                            dest_port: destPort,
                            message: 'Не удалось проложить дорожный маршрут. Предлагается перенаправление к ближайшим портам (отправление и прибытие).'
                        }
                    });
                }

                // If only dest port found, suggest it
                const nearestPort = destPort;
                if (nearestPort) {
                    return res.json({
                        route_possible: false,
                        suggestion: {
                            type: 'redirect_to_port',
                            segment_index: i,
                            port: nearestPort,
                            message: 'Не удалось проложить дорожный маршрут между точками. Предлагается перенаправление к ближайшему порту.'
                        }
                    });
                }

                // If no port found - return direct coordinates as fallback
                const directPath = points.map(p => ({ lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) }));
                return res.json({ polyline: directPath, distance: null, duration: null, route_possible: false });
            }

            // Append segment geometry
            if (segmentRoute.geometry) {
                try {
                    const coords = decodePolyline(segmentRoute.geometry);
                    fullPolyline.push(...coords);
                } catch (e) {
                    // ignore decode errors
                }
            } else if (segmentRoute.steps) {
                // if multimodal returns steps or location info, approximate by endpoints
                fullPolyline.push({ lat: startLat, lng: startLon });
                fullPolyline.push({ lat: endLat, lng: endLon });
            }

            if (segmentRoute.distance) totalDistance += segmentRoute.distance;
            if (segmentRoute.duration) totalDuration += segmentRoute.duration;
        }

        res.json({
            polyline: fullPolyline,
            distance: totalDistance ? totalDistance.toFixed(1) : null,
            duration: totalDuration ? (totalDuration / 3600).toFixed(1) : null,
            route_possible: true
        });
    } catch (error) {
        console.error('Route error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить точки поездки
router.get('/:tripId/points', authenticateToken, async (req, res) => {
    try {
        const points = await prisma.tripPoint.findMany({
            where: { trip_id: parseInt(req.params.tripId) },
            orderBy: { order_index: 'asc' }
        });
        res.json(points);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Добавить точку
router.post('/:tripId/points', authenticateToken, async (req, res) => {
    try {
        const tripId = parseInt(req.params.tripId);
        let { place_name, address, latitude, longitude, order_index, day_id } = req.body;
        
        console.log('Adding point request:', { place_name, address, latitude, longitude });
        
        if (address && (!latitude || !longitude)) {
            const geocoded = await geocodeAddress(address);
            if (geocoded) {
                latitude = geocoded.latitude;
                longitude = geocoded.longitude;
                if (!place_name || place_name.trim() === '') {
                    place_name = geocoded.place_name;
                }
                address = geocoded.address;
                console.log('Geocoded:', { name: place_name, addr: address, lat: latitude, lng: longitude });
            } else {
                return res.status(400).json({ error: 'Не удалось определить координаты по указанному адресу' });
            }
        }

        // If geocoded but vague (country or low confidence) - offer suggestions
        if (address && (!place_name || place_name.toLowerCase() === address.toLowerCase())) {
            // try to fetch suggestions by city
            try {
                const { searchPlacesByCity } = require('../services/placesService');
                const cityName = address.split(',')[0];
                const suggestions = await searchPlacesByCity(cityName);
                if (suggestions && suggestions.length > 0) {
                    return res.status(200).json({ ambiguous: true, suggestions });
                }
            } catch (e) {
                console.error('Suggestion lookup error:', e.message);
            }
        }
        
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Необходимо указать координаты или адрес' });
        }
        
        let finalPlaceName = place_name || 'Новая точка';
        let finalAddress = address || '';
        
        if (finalAddress && finalPlaceName === finalAddress) {
            finalAddress = '';
        }
        

        if (day_id) {
        const day = await prisma.tripDay.findFirst({
            where: { id: parseInt(day_id), trip_id: tripId }
        });
        if (!day) {
            return res.status(400).json({ error: 'Указанный день не принадлежит этой поездке' });
        }
        }

        const point = await prisma.tripPoint.create({
        data: {
            trip_id: tripId,
            place_name: finalPlaceName,
            address: finalAddress || null,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            order_index: order_index || 0,
            day_id: day_id ? parseInt(day_id) : null
        }
        });
        
        console.log('Point created:', { id: point.id, name: point.place_name });
        res.status(201).json(point);
    } catch (error) {
        console.error('Error adding point:', error);
        res.status(500).json({ error: error.message });
    }
});

// Удалить точку
router.delete('/points/:pointId', authenticateToken, async (req, res) => {
    try {
        await prisma.tripPoint.delete({
            where: { id: parseInt(req.params.pointId) }
        });
        res.json({ message: 'Точка удалена' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Генерация дней поездки
router.post('/:tripId/days/generate', authenticateToken, async (req, res) => {
    try {
        const tripId = parseInt(req.params.tripId);
        const { start_date, end_date } = req.body;
        
        console.log('Generating days for trip:', tripId, start_date, end_date);
        
        const start = new Date(start_date);
        const end = new Date(end_date);
        const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        await prisma.tripDay.deleteMany({
            where: { trip_id: tripId }
        });
        
        const days = [];
        for (let i = 0; i < daysCount; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);
            
            const day = await prisma.tripDay.create({
                data: {
                    trip_id: tripId,
                    day_number: i + 1,
                    date: currentDate,
                    title: `День ${i + 1}`
                }
            });
            days.push(day);
        }
        
        console.log(`Generated ${days.length} days for trip ${tripId}`);
        res.json(days);
    } catch (error) {
        console.error('Error generating days:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить все дни поездки
router.get('/:tripId/days', authenticateToken, async (req, res) => {
    try {
        const tripId = parseInt(req.params.tripId);
        
        const days = await prisma.tripDay.findMany({
            where: { trip_id: tripId },
            include: {
                points: {
                    orderBy: { order_index: 'asc' }
                }
            },
            orderBy: { day_number: 'asc' }
        });
        
        res.json(days);
    } catch (error) {
        console.error('Error fetching days:', error);
        res.status(500).json({ error: error.message });
    }
});

// Добавить точку в день
router.post('/:tripId/days/:dayId/points', authenticateToken, async (req, res) => {
    try {
        const tripId = parseInt(req.params.tripId);
        const dayId = parseInt(req.params.dayId);
        const { address } = req.body;
        
        console.log('Adding point to day:', { tripId, dayId, address });
        
        if (!address) {
            return res.status(400).json({ error: 'Адрес обязателен' });
        }
        
        const lastPoint = await prisma.tripPoint.findFirst({
            where: { day_id: dayId },
            orderBy: { order_index: 'desc' }
        });
        
        let latitude = null;
        let longitude = null;
        let placeName = address.split(',')[0];
        
        const geocoded = await geocodeAddress(address);
        if (geocoded) {
            latitude = geocoded.latitude;
            longitude = geocoded.longitude;
            placeName = geocoded.place_name || address.split(',')[0];
        }
        
        const point = await prisma.tripPoint.create({
            data: {
                trip_id: tripId,
                day_id: dayId,
                place_name: placeName,
                address: address,
                latitude: latitude,
                longitude: longitude,
                order_index: (lastPoint?.order_index || 0) + 1
            }
        });
        
        console.log('Point added to day:', point.id);
        res.json(point);
    } catch (error) {
        console.error('Error adding point to day:', error);
        res.status(500).json({ error: error.message });
    }
});

// Назначить точку на день
router.put('/points/:pointId/assign-day', authenticateToken, async (req, res) => {
    try {
        const pointId = parseInt(req.params.pointId);
        const { day_id } = req.body;
        
        const point = await prisma.tripPoint.update({
            where: { id: pointId },
            data: { day_id: day_id }
        });
        
        res.json(point);
    } catch (error) {
        console.error('Error assigning point to day:', error);
        res.status(500).json({ error: error.message });
    }
});

// Убрать точку из дня
router.put('/points/:pointId/unassign', authenticateToken, async (req, res) => {
    try {
        const pointId = parseInt(req.params.pointId);
        
        const point = await prisma.tripPoint.update({
            where: { id: pointId },
            data: { day_id: null }
        });
        
        res.json(point);
    } catch (error) {
        console.error('Error unassigning point:', error);
        res.status(500).json({ error: error.message });
    }
});

function decodePolyline(encoded) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    
    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        
        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        
        points.push({ lat: lat / 1E5, lng: lng / 1E5 });
    }
    return points;
}

module.exports = router;