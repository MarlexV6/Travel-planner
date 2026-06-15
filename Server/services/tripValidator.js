const axios = require('axios');
const prisma = require('../config/database');

const SPEEDS = {
    driving: 80,
    train: 100,
    flight: 800,
    ferry: 50,
    walking: 5,
    public_transport: 40
};

class TripValidator {
    
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.asin(Math.sqrt(a));
        return R * c;
    }

    static async getRouteInfo(from, to) {
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`;
            const response = await axios.get(url, {
                params: { overview: 'full', geometries: 'polyline' },
                timeout: 10000
            });
            
            if (response.data?.routes?.[0]) {
                const route = response.data.routes[0];
                return {
                    distance: route.distance / 1000,
                    duration: route.duration / 3600,
                    geometry: route.geometry
                };
            }
            return null;
        } catch (error) {
            console.error('OSRM error:', error.message);
            return null;
        }
    }

    static async validateWholeTrip(tripId, userId) {
        try {
            const trip = await prisma.trip.findFirst({
                where: { id: parseInt(tripId), user_id: parseInt(userId) },
                include: { points: { orderBy: { order_index: 'asc' } } }
            });

            if (!trip) throw new Error('Поездка не найдена');
            if (trip.points.length < 2) {
                return { isValid: true, warnings: [], segments: [], summary: 'Маршрут содержит менее 2 точек' };
            }

            await prisma.tripWarning.deleteMany({ where: { trip_id: trip.id } });

            const segments = [];
            const warningsList = [];
            let isValid = true;

            let totalAvailableHours = null;
            if (trip.start_date && trip.end_date) {
                const start = new Date(trip.start_date);
                const end = new Date(trip.end_date);
                const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                totalAvailableHours = totalDays * 24;
            }

            let totalTravelTime = 0;

            for (let i = 0; i < trip.points.length - 1; i++) {
                const fromPoint = trip.points[i];
                const toPoint = trip.points[i + 1];
                
                const fromCoords = { lat: parseFloat(fromPoint.latitude), lng: parseFloat(fromPoint.longitude) };
                const toCoords = { lat: parseFloat(toPoint.latitude), lng: parseFloat(toPoint.longitude) };
                
                const straightDistance = this.calculateDistance(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng);
                const routeInfo = await this.getRouteInfo(fromCoords, toCoords);

                let travelMode = 'driving';
                let travelTime = routeInfo?.duration || (straightDistance / SPEEDS.driving);
                
                if (straightDistance > 500) {
                    travelMode = 'flight';
                    travelTime = straightDistance / SPEEDS.flight + 3;
                } else if (straightDistance > 200) {
                    travelMode = 'train';
                    travelTime = straightDistance / SPEEDS.train;
                }
                
                totalTravelTime += travelTime;

                const pointsCount = trip.points.length;
                const availableHoursPerSegment = totalAvailableHours ? totalAvailableHours / (pointsCount - 1) : null;
                
                let isSegmentFeasible = true;
                const segmentWarnings = [];

                if (availableHoursPerSegment && travelTime > availableHoursPerSegment) {
                    isSegmentFeasible = false;
                    isValid = false;
                    const hoursNeeded = travelTime - availableHoursPerSegment;
                    segmentWarnings.push({
                        type: 'time',
                        severity: 'error',
                        title: 'НЕВОЗМОЖНО УСПЕТЬ!',
                        message: `От "${fromPoint.place_name}" до "${toPoint.place_name}" — ${travelTime.toFixed(1)} ч пути, но между датами только ${availableHoursPerSegment.toFixed(1)} ч. Не хватает ${hoursNeeded.toFixed(1)} ч.`,
                        suggestion: `• Добавьте ${Math.ceil(hoursNeeded / 24)} дополнительных дней\n• Удалите одну из точек\n• Используйте более быстрый транспорт (самолет)`
                    });
                } else if (availableHoursPerSegment && travelTime > availableHoursPerSegment * 0.6) {
                    segmentWarnings.push({
                        type: 'time_warning',
                        severity: 'warning',
                        title: 'Напряженный график',
                        message: `От "${fromPoint.place_name}" до "${toPoint.place_name}" — ${travelTime.toFixed(1)} ч пути (${Math.round(travelTime / availableHoursPerSegment * 100)}% доступного времени)`,
                        suggestion: 'Добавьте дополнительный день для отдыха'
                    });
                }
                
                if (straightDistance > 1000) {
                    segmentWarnings.push({
                        type: 'distance',
                        severity: 'warning',
                        title: 'Очень большое расстояние',
                        message: `Расстояние: ${straightDistance.toFixed(0)} км. Рекомендуется использовать самолет.`,
                        suggestion: 'Запланируйте перелет, это займет около 3-4 часов с учетом дороги в аэропорт'
                    });
                }
                
                for (const w of segmentWarnings) {
                    const saved = await prisma.tripWarning.create({
                        data: {
                            trip_id: trip.id,
                            warning_type: w.type,
                            severity: w.severity,
                            title: w.title,
                            message: w.message,
                            suggestion: w.suggestion
                        }
                    });
                    warningsList.push(saved);
                }

                const segment = await prisma.tripSegment.upsert({
                    where: {
                        trip_id_from_point_id_to_point_id: {
                            trip_id: trip.id,
                            from_point_id: fromPoint.id,
                            to_point_id: toPoint.id
                        }
                    },
                    update: {
                        distance_km: straightDistance,
                        travel_time_hours: travelTime,
                        travel_mode: travelMode,
                        is_feasible: isSegmentFeasible,
                        warning_message: segmentWarnings.map(w => w.message).join('; ')
                    },
                    create: {
                        trip_id: trip.id,
                        from_point_id: fromPoint.id,
                        to_point_id: toPoint.id,
                        distance_km: straightDistance,
                        travel_time_hours: travelTime,
                        travel_mode: travelMode,
                        is_feasible: isSegmentFeasible,
                        warning_message: segmentWarnings.map(w => w.message).join('; ')
                    }
                });
                
                segments.push({
                    from: fromPoint.place_name,
                    to: toPoint.place_name,
                    distance: straightDistance.toFixed(0),
                    travelTime: travelTime.toFixed(1),
                    mode: travelMode,
                    isFeasible: isSegmentFeasible,
                    warnings: segmentWarnings
                });
            }
            
            let overallStatus = 'Маршрут выполним';
            if (!isValid) {
                overallStatus = 'МАРШРУТ НЕВЫПОЛНИМ — добавьте больше дней или упростите маршрут';
            } else if (totalTravelTime > 0 && totalAvailableHours && totalTravelTime > totalAvailableHours * 0.7) {
                overallStatus = 'Маршрут сложный, но выполним. Рекомендуется добавить дни для отдыха.';
            }
            
            return {
                isValid,
                warnings: warningsList,
                segments,
                summary: {
                    status: overallStatus,
                    totalDistance: segments.reduce((sum, s) => sum + parseFloat(s.distance), 0).toFixed(0),
                    totalTravelTime: totalTravelTime.toFixed(1),
                    totalWarnings: warningsList.length,
                    criticalErrors: warningsList.filter(w => w.severity === 'error').length
                }
            };
        } catch (error) {
            console.error('Validation error:', error);
            throw error;
        }
    }
}

module.exports = TripValidator;