const axios = require('axios');


async function getImageForPlace(placeName, category) {
    try {

        const imagePromise = getImageFromWikipedia(placeName);
        const timeoutPromise = new Promise((resolve) => 
            setTimeout(() => resolve(null), 3000)  
        );
        
        return await Promise.race([imagePromise, timeoutPromise]);
    } catch (error) {
        console.error('Error fetching image for place:', placeName, error.message);
        return null;
    }
}

async function getImageFromWikipedia(placeName) {
    try {

        const searchResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
            params: {
                action: 'query',
                format: 'json',
                titles: placeName,
                prop: 'pageimages',
                pithumbsize: 300,
                origin: '*'
            },
            timeout: 2500
        });

        const pages = searchResponse.data.query.pages;
        for (const page of Object.values(pages)) {
            if (page.thumbnail) {
                return page.thumbnail.source;
            }
        }


        const commonsResponse = await axios.get('https://commons.wikimedia.org/w/api.php', {
            params: {
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: placeName,
                srnamespace: '6', 
                srlimit: 1,
                origin: '*'
            },
            timeout: 2500
        });

        if (commonsResponse.data.query.search && commonsResponse.data.query.search.length > 0) {
            const fileName = commonsResponse.data.query.search[0].title;
            const fileInfoResponse = await axios.get('https://commons.wikimedia.org/w/api.php', {
                params: {
                    action: 'query',
                    titles: fileName,
                    prop: 'imageinfo',
                    iiprop: 'url',
                    format: 'json',
                    origin: '*'
                },
                timeout: 2500
            });

            const filePages = fileInfoResponse.data.query.pages;
            for (const page of Object.values(filePages)) {
                if (page.imageinfo && page.imageinfo[0]) {
                    const url = page.imageinfo[0].url;
                    if (url) {
                        return url;
                    }
                }
            }
        }

        return null;
    } catch (error) {
        console.error('Error fetching image from Wikipedia for:', placeName, error.message);
        return null;
    }
}

async function getPlacesNearby(lat, lng, radius = 5000) {
    try {
        const latMin = lat - (radius / 90000);
        const latMax = lat + (radius / 90000);
        const lonMin = lng - (radius / (90000 * Math.cos(lat * Math.PI / 180)));
        const lonMax = lng + (radius / (90000 * Math.cos(lat * Math.PI / 180)));
        const overpassQuery = `
            [out:json][timeout:45];
            (
                node["tourism"]["name"](${latMin},${lonMin},${latMax},${lonMax});
                node["historic"]["name"](${latMin},${lonMin},${latMax},${lonMax});
                node["leisure"~"park|garden|nature_reserve"]["name"](${latMin},${lonMin},${latMax},${lonMax});
                node["amenity"~"cinema|theatre|library|fountain|museum|artwork"]["name"](${latMin},${lonMin},${latMax},${lonMax});
                node["man_made"~"tower|lighthouse|windmill"]["name"](${latMin},${lonMin},${latMax},${lonMax});
                node["natural"~"peak|volcano|waterfall|cave|spring"]["name"](${latMin},${lonMin},${latMax},${lonMax});
                way["tourism"]["name"](${latMin},${lonMin},${latMax},${lonMax});
                way["historic"]["name"](${latMin},${lonMin},${latMax},${lonMax});
                way["leisure"~"park|garden"]["name"](${latMin},${lonMin},${latMax},${lonMax});
                relation["tourism"]["name"](${latMin},${lonMin},${latMax},${lonMax});
                relation["historic"]["name"](${latMin},${lonMin},${latMax},${lonMax});
            );
            out body;
            out skel qt;
        `;
        const response = await axios.post('https://overpass-api.de/api/interpreter', 
            `data=${encodeURIComponent(overpassQuery)}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'TravelPlannerApp/1.0'
                },
                timeout: 45000
            }
        );
        const places = [];
        const badNameValues = new Set(['information', 'viewpoint', 'attraction', 'tourism', 'historic', 'amenity', 'leisure']);
        
        if (response.data && response.data.elements) {
            for (const element of response.data.elements) {
                let lat = element.lat;
                let lon = element.lon;
                
                if (!lat && element.center) {
                    lat = element.center.lat;
                    lon = element.center.lon;
                }
                if (lat && lon) {
                    const placeInfo = extractPlaceInfo(element);
                    const rawName = (element.tags && (element.tags.name || element.tags['name:ru'] || element.tags['name:en'])) || '';
  
                    const hasRealName = placeInfo.name && placeInfo.name.length > 2 && !badNameValues.has(placeInfo.name.toLowerCase());
                    const hasProperNameTag = !!rawName && rawName.length > 2;
                    
                    if (hasRealName && hasProperNameTag) {
                        places.push({
                            id: element.id,
                            name: placeInfo.name,
                            address: placeInfo.address,
                            latitude: lat,
                            longitude: lon,
                            category: placeInfo.category,
                            description: placeInfo.description
                        });
                    }
                }
            }
        }
        const uniquePlaces = [];
        const seen = new Set();
        for (const place of places) {
            const key = `${place.name}-${place.latitude.toFixed(3)}-${place.longitude.toFixed(3)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniquePlaces.push(place);
            }
        }
        

        return uniquePlaces;
    } catch (error) {
        console.error('Error fetching places:', error.message);
        return [];
    }
}

function extractPlaceInfo(element) {
    const tags = element.tags || {};
    
    let category = 'Достопримечательность';
    if (tags.tourism) {
        const tourismMap = {
            'museum': 'Музей',
            'attraction': 'Аттракцион',
            'gallery': 'Галерея',
            'zoo': 'Зоопарк',
            'aquarium': 'Аквариум',
            'theme_park': 'Парк аттракционов',
            'viewpoint': 'Смотровая площадка',
            'information': 'Информационный стенд'
        };
        category = tourismMap[tags.tourism] || 'Достопримечательность';
    } else if (tags.historic) {
        const historicMap = {
            'castle': 'Замок',
            'monument': 'Памятник',
            'memorial': 'Мемориал',
            'church': 'Церковь',
            'cathedral': 'Собор',
            'ruins': 'Руины',
            'archaeological_site': 'Археологический памятник'
        };
        category = historicMap[tags.historic] || 'Историческое место';
    } else if (tags.leisure === 'park') {
        category = 'Парк';
    } else if (tags.amenity === 'cinema') {
        category = 'Кинотеатр';
    } else if (tags.amenity === 'theatre') {
        category = 'Театр';
    }
    

    let name = tags['name:ru'] || tags.name || tags['name:en'] || null;
    

    const addressParts = [];
    const addrCity = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['addr:suburb'];
    if (addrCity) addressParts.push(addrCity);
    
    if (tags['addr:street'] && !addressParts.includes(tags['addr:street'])) {
        addressParts.push(tags['addr:street']);
    }
    if (tags['addr:housenumber']) {
        addressParts.push(tags['addr:housenumber']);
    }

    if (tags['addr:place'] && !addressParts.includes(tags['addr:place'])) addressParts.push(tags['addr:place']);
    
    let address = addressParts.join(', ');
    if (!address && tags['addr:country']) {
        address = tags['addr:country'];
    }

    
    let description = tags.description || tags['description:ru'] || tags['wikipedia'] || null;
    
    return { name, address, category, description };
}

async function searchPlacesByCity(cityName) {
    try {
        const geoResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: cityName,
                format: 'json',
                limit: 1,
                addressdetails: 1,
                'accept-language': 'ru'
            },
            headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
        });
        
        if (geoResponse.data && geoResponse.data.length > 0) {
            const location = geoResponse.data[0];
            const lat = parseFloat(location.lat);
            const lng = parseFloat(location.lon);
            const places = await getPlacesNearby(lat, lng, 15000);
            
            const cityShort = cityName.split(',')[0];
            return places.map(place => ({
                ...place,
                address: place.address || cityShort
            }));
        }
        return [];
    } catch (error) {
        console.error('Error searching places by city:', error);
        return [];
    }
}

function getPopularPlaces(cityName) {
    const popularPlaces = {
        'Минск': [
            { name: 'Площадь Независимости', address: 'Минск, площадь Независимости', category: 'Площадь', latitude: 53.893009, longitude: 27.567444, description: 'Главная площадь Минска', image_url: null },
            { name: 'Национальная библиотека Беларуси', address: 'Минск, проспект Независимости, 116', category: 'Библиотека', latitude: 53.931333, longitude: 27.645778, description: 'Символ Минска', image_url: null }
        ],
        'Гродно': [
            { name: 'Старый замок', address: 'Гродно, Замковая улица', category: 'Замок', latitude: 53.677500, longitude: 23.831111, description: 'Королевский замок', image_url: null }
        ],
        'Брест': [
            { name: 'Брестская крепость', address: 'Брест, ул. Героев обороны', category: 'Крепость', latitude: 52.083333, longitude: 23.653333, description: 'Крепость-герой', image_url: null }
        ],
        'Витебск': [
            { name: 'Успенский собор', address: 'Витебск, ул. Крылова', category: 'Собор', latitude: 55.1950, longitude: 30.2047, description: 'Главный собор города', image_url: null }
        ],
        'Могилев': [
            { name: 'Площадь Звезд', address: 'Могилев, площадь Звезд', category: 'Площадь', latitude: 53.9167, longitude: 30.3333, description: 'Главная площадь Могилева', image_url: null }
        ]
    };
    
    const places = (cityName && popularPlaces[cityName]) ? popularPlaces[cityName] : popularPlaces['Минск'];
    

    return Promise.all(
        places.map(async (place) => {
            const imageUrl = await getImageForPlace(place.name, place.category);
            return {
                ...place,
                image_url: imageUrl
            };
        })
    );
}

async function getNearestPort(lat, lon, radius = 50000) {
    try {

        const latMin = lat - (radius / 90000);
        const latMax = lat + (radius / 90000);
        const lonMin = lon - (radius / (90000 * Math.cos(lat * Math.PI / 180)));
        const lonMax = lon + (radius / (90000 * Math.cos(lat * Math.PI / 180)));
        const query = `
            [out:json][timeout:25];
            (
                node["harbour"](${latMin},${lonMin},${latMax},${lonMax});
                node["seamark:type"="harbour"](${latMin},${lonMin},${latMax},${lonMax});
                node["man_made"="pier"](${latMin},${lonMin},${latMax},${lonMax});
                node["port"](${latMin},${lonMin},${latMax},${lonMax});
                way["harbour"](${latMin},${lonMin},${latMax},${lonMax});
                relation["harbour"](${latMin},${lonMin},${latMax},${lonMax});
            );
            out center;
        `;
        const resp = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });

        const elements = resp.data.elements || [];
        if (elements.length === 0) return null;


        let best = null;
        for (const el of elements) {
            const elLat = el.lat || (el.center && el.center.lat);
            const elLon = el.lon || (el.center && el.center.lon);
            if (!elLat || !elLon) continue;
            const d = Math.sqrt(Math.pow(elLat - lat, 2) + Math.pow(elLon - lon, 2));
            if (!best || d < best.dist) {
                best = { element: el, dist: d, latitude: elLat, longitude: elLon };
            }
        }

        if (!best) return null;

        const name = best.element.tags && (best.element.tags.name || best.element.tags['name:en'] || best.element.tags['name:ru']) || 'Порт/Марина';
        return {
            name,
            latitude: best.latitude,
            longitude: best.longitude
        };
    } catch (error) {
        console.error('Error finding nearest port:', error.message);
        return null;
    }
}

async function getNearbyHotels(lat, lng, radius = 15000) {
    try {
        const latMin = lat - (radius / 90000);
        const latMax = lat + (radius / 90000);
        const lonMin = lng - (radius / (90000 * Math.cos(lat * Math.PI / 180)));
        const lonMax = lng + (radius / (90000 * Math.cos(lat * Math.PI / 180)));

        const overpassQuery = `
            [out:json][timeout:45];
            (
                node["tourism"~"hotel|hostel|guest_house|apartment|chalet|motel"]["name"]( ${latMin},${lonMin},${latMax},${lonMax} );
                node["amenity"="hotel"]["name"]( ${latMin},${lonMin},${latMax},${lonMax} );
                node["building"="hotel"]["name"]( ${latMin},${lonMin},${latMax},${lonMax} );
                way["tourism"~"hotel|hostel|guest_house"]["name"]( ${latMin},${lonMin},${latMax},${lonMax} );
            );
            out body;
            out skel qt;
        `;

        const response = await axios.post('https://overpass-api.de/api/interpreter',
            `data=${encodeURIComponent(overpassQuery)}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'TravelPlannerApp/1.0'
                },
                timeout: 45000
            }
        );

        const hotels = [];
        const elements = (response.data && response.data.elements) || [];

        for (const element of elements) {
            let hlat = element.lat;
            let hlon = element.lon;
            if (!hlat && element.center) {
                hlat = element.center.lat;
                hlon = element.center.lon;
            }
            if (!hlat || !hlon) continue;

            const tags = element.tags || {};
            const name = tags['name:ru'] || tags.name || tags['name:en'] || 'Отель';
            if (!name || name.length < 2) continue;

            const addressParts = [];
            if (tags['addr:city']) addressParts.push(tags['addr:city']);
            else if (tags['addr:town']) addressParts.push(tags['addr:town']);
            if (tags['addr:street']) addressParts.push(tags['addr:street']);
            if (tags['addr:housenumber']) addressParts.push(tags['addr:housenumber']);

            hotels.push({
                id: element.id,
                name,
                address: addressParts.join(', ') || (tags['addr:city'] || tags['addr:country'] || ''),
                latitude: hlat,
                longitude: hlon,
                category: 'Отель',
                description: tags.description || tags['description:ru'] || 'Место для проживания'
            });
        }

        const unique = [];
        const seen = new Set();
        for (const h of hotels) {
            const key = `${h.name}-${h.latitude.toFixed(3)}-${h.longitude.toFixed(3)}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(h);
            }
        }
        return unique.slice(0, 8); 
    } catch (error) {
        console.error('Error fetching nearby hotels:', error.message);
        return [];
    }
}


async function getTopAttractions(cityNameOrCoords, limit = 10) {
    try {
        let lat, lng, cityShort = '';

        if (typeof cityNameOrCoords === 'string') {
            const geoResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: {
                    q: cityNameOrCoords,
                    format: 'json',
                    limit: 1,
                    addressdetails: 1,
                    'accept-language': 'ru'
                },
                headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
            });
            if (!geoResponse.data || geoResponse.data.length === 0) return [];
            const loc = geoResponse.data[0];
            lat = parseFloat(loc.lat);
            lng = parseFloat(loc.lon);
            cityShort = cityNameOrCoords.split(',')[0];
        } else if (cityNameOrCoords && cityNameOrCoords.lat != null) {
            lat = parseFloat(cityNameOrCoords.lat);
            lng = parseFloat(cityNameOrCoords.lng || cityNameOrCoords.lon);
        } else {
            return [];
        }

        const allNearby = await getPlacesNearby(lat, lng, 20000);


        let attractions = allNearby.filter(p => {
            const isNotHotel = !/отель|гостиниц|hotel|hostel|апартамент/i.test((p.category || '') + ' ' + (p.name || ''));
            return isNotHotel && p.name && p.name.length > 2;
        });


        if (attractions.length < 5) {
            attractions = allNearby.filter(p => !/отель|гостиниц|hotel|hostel/i.test((p.category||'') + ' ' + (p.name||'')));
        }

        const top = attractions.slice(0, limit).map(p => ({
            ...p,
            address: p.address || cityShort
        }));

        return top;
    } catch (error) {
        console.error('Error getting top attractions:', error.message);
        return [];
    }
}

async function getCityDiscovery(cityName) {
    try {
        if (!cityName || !cityName.trim()) return { center: null, attractions: [], hotels: [] };

        const geoResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: cityName,
                format: 'json',
                limit: 1,
                addressdetails: 1,
                'accept-language': 'ru'
            },
            headers: { 'User-Agent': 'TravelPlannerApp/1.0' }
        });

        if (!geoResponse.data || geoResponse.data.length === 0) {
            return { center: null, attractions: [], hotels: [] };
        }

        const loc = geoResponse.data[0];
        const lat = parseFloat(loc.lat);
        const lng = parseFloat(loc.lon);
        const centerName = loc.address?.city || loc.address?.town || loc.address?.village || cityName.split(',')[0];

        const center = {
            name: centerName,
            latitude: lat,
            longitude: lng,
            address: loc.display_name || cityName,
            category: 'Город / Центр'
        };


        const rawNearby = await getPlacesNearby(lat, lng, 30000);


        let attractions = rawNearby
            .filter(p => !/отель|гостиниц|hotel|hostel|апартамент/i.test((p.category || '') + ' ' + (p.name || '')))
            .slice(0, 10);

        if (attractions.length < 5) {
            const top = await getTopAttractions({ lat, lng }, 10);
            const existingNames = new Set(attractions.map(a => a.name.toLowerCase()));
            for (const t of top) {
                if (!existingNames.has(t.name.toLowerCase())) {
                    attractions.push(t);
                    if (attractions.length >= 10) break;
                }
            }
        }

        const cityShort = centerName || cityName.split(',')[0];
        attractions = attractions.map(a => ({
            ...a,
            address: a.address && a.address.length > 3 ? a.address : cityShort
        }));

  
        let hotels = await getNearbyHotels(lat, lng, 20000);
        if (hotels.length === 0 && rawNearby.length > 0) {
            hotels = rawNearby
                .filter(p => /отель|гостиниц|hotel|hostel|апартамент/i.test((p.category || '') + ' ' + (p.name || '')))
                .slice(0, 8);
        }
        hotels = hotels.map(h => ({
            ...h,
            address: h.address && h.address.length > 3 ? h.address : cityShort
        }));

  
        if (attractions.length === 0 && center) {
            attractions.push({
                name: `Центр ${center.name}`,
                address: center.address || cityShort,
                latitude: center.latitude,
                longitude: center.longitude,
                category: 'Центр города',
                description: 'Центральная точка / ориентир'
            });
        }

        return { center, attractions: attractions.slice(0, 10), hotels };
    } catch (error) {
        console.error('Error in getCityDiscovery:', error.message);
        return { center: null, attractions: [], hotels: [] };
    }
}

module.exports = {
    getPlacesNearby,
    searchPlacesByCity,
    getPopularPlaces,
    getNearestPort,
    getNearbyHotels,
    getTopAttractions,
    getCityDiscovery
};