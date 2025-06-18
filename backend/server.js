const express = require('express');
const cors = require('cors');
require('dotenv').config();

const Database = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Instancia de base de datos
const database = new Database();

// CRUD de Aeropuertos

// GET /airports - Listar todos los aeropuertos
app.get('/airports', async (req, res) => {
  try {
    const { airports } = database.getCollections();
    const allAirports = await airports.find({}).toArray();
    res.json(allAirports);
  } catch (error) {
    console.error('Error obteniendo aeropuertos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /airports/popular - Aeropuertos más populares (DEBE IR ANTES de /:iata_code)
app.get('/airports/popular', async (req, res) => {
  try {
    const { popularity } = database.getRedisClients();
    const { airports } = database.getCollections();

    console.log('🏆 Solicitando aeropuertos populares...');

    // Usar el método correcto de Redis v4
    const popularData = await popularity.zRangeWithScores('airport_popularity', 0, 9, { REV: true });
    
    console.log('📊 Datos de Redis:', popularData);

    if (popularData.length === 0) {
      console.log('⚠️ No hay datos de popularidad');
      return res.json([]);
    }

    // Convertir resultado de Redis a formato útil
    const result = [];
    
    for (const item of popularData) {
      const iataCode = item.value;
      const score = item.score;
      
      console.log(`🔍 Buscando aeropuerto: ${iataCode} con ${score} visitas`);
      
      const airport = await airports.findOne({ iata_faa: iataCode });
      if (airport) {
        result.push({
          ...airport,
          visits: parseInt(score)
        });
        console.log(`✅ Encontrado: ${airport.name}`);
      } else {
        console.log(`❌ No encontrado en MongoDB: ${iataCode}`);
      }
    }

    console.log(`📈 Retornando ${result.length} aeropuertos populares`);
    res.json(result);
  } catch (error) {
    console.error('❌ Error obteniendo aeropuertos populares:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Consultas Geoespaciales

// GET /airports/nearby - Buscar aeropuertos cercanos
app.get('/airports/nearby', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng || !radius) {
      return res.status(400).json({ error: 'Parámetros requeridos: lat, lng, radius' });
    }

    const { geo } = database.getRedisClients();
    const { airports } = database.getCollections();

    console.log(`🗺️ Buscando aeropuertos cerca de ${lat}, ${lng} en radio ${radius}km`);

    // Usar la sintaxis correcta para Redis v4
    const nearbyIataCodes = await geo.geoSearchWith(
      'airports-geo',
      {
        type: 'FROMLONLAT',
        coordinates: {
          longitude: parseFloat(lng),
          latitude: parseFloat(lat)
        }
      },
      {
        type: 'BYRADIUS',
        radius: parseFloat(radius),
        unit: 'km'
      },
      ['WITHDIST']
    );

    console.log('📍 Aeropuertos cercanos encontrados:', nearbyIataCodes);

    if (nearbyIataCodes.length === 0) {
      return res.json([]);
    }

    // Extraer solo los códigos IATA
    const codes = nearbyIataCodes.map(item => item.member);

    // Obtener detalles completos de MongoDB
    const nearbyAirports = await airports.find({
      iata_faa: { $in: codes }
    }).toArray();

    console.log(`✅ Retornando ${nearbyAirports.length} aeropuertos cercanos`);
    res.json(nearbyAirports);
  } catch (error) {
    console.error('❌ Error buscando aeropuertos cercanos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /airports/:iata_code - Obtener aeropuerto específico y aumentar popularidad
app.get('/airports/:iata_code', async (req, res) => {
  try {
    const { iata_code } = req.params;
    const { airports } = database.getCollections();
    const { popularity } = database.getRedisClients();

    const airport = await airports.findOne({ iata_faa: iata_code.toUpperCase() });
    
    if (!airport) {
      return res.status(404).json({ error: 'Aeropuerto no encontrado' });
    }

    // Incrementar popularidad
    await popularity.zIncrBy('airport_popularity', 1, iata_code.toUpperCase());

    res.json(airport);
  } catch (error) {
    console.error('Error obteniendo aeropuerto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /airports - Crear nuevo aeropuerto
app.post('/airports', async (req, res) => {
  try {
    const airportData = req.body;
    const { airports } = database.getCollections();
    const { geo } = database.getRedisClients();

    // Validar datos requeridos
    if (!airportData.iata_faa || !airportData.lat || !airportData.lng) {
      return res.status(400).json({ error: 'Faltan datos requeridos: iata_faa, lat, lng' });
    }

    // Verificar si ya existe
    const existing = await airports.findOne({ iata_faa: airportData.iata_faa.toUpperCase() });
    if (existing) {
      return res.status(409).json({ error: 'El aeropuerto ya existe' });
    }

    // Guardar en MongoDB
    airportData.iata_faa = airportData.iata_faa.toUpperCase();
    const result = await airports.insertOne(airportData);

    // Agregar a Redis GEO
    await geo.geoAdd('airports-geo', {
      longitude: parseFloat(airportData.lng),
      latitude: parseFloat(airportData.lat),
      member: airportData.iata_faa
    });

    res.status(201).json({ ...airportData, _id: result.insertedId });
  } catch (error) {
    console.error('Error creando aeropuerto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /airports/:iata_code - Actualizar aeropuerto
app.put('/airports/:iata_code', async (req, res) => {
  try {
    const { iata_code } = req.params;
    const updateData = req.body;
    const { airports } = database.getCollections();
    const { geo } = database.getRedisClients();

    const result = await airports.updateOne(
      { iata_faa: iata_code.toUpperCase() },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Aeropuerto no encontrado' });
    }

    // Actualizar coordenadas en Redis GEO si cambiaron
    if (updateData.lat && updateData.lng) {
      await geo.geoAdd('airports-geo', {
        longitude: parseFloat(updateData.lng),
        latitude: parseFloat(updateData.lat),
        member: iata_code.toUpperCase()
      });
    }

    const updatedAirport = await airports.findOne({ iata_faa: iata_code.toUpperCase() });
    res.json(updatedAirport);
  } catch (error) {
    console.error('Error actualizando aeropuerto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /airports/:iata_code - Eliminar aeropuerto
app.delete('/airports/:iata_code', async (req, res) => {
  try {
    const { iata_code } = req.params;
    const { airports } = database.getCollections();
    const { geo, popularity } = database.getRedisClients();

    const result = await airports.deleteOne({ iata_faa: iata_code.toUpperCase() });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Aeropuerto no encontrado' });
    }

    // Eliminar de Redis GEO y Popularidad
    await geo.zRem('airports-geo', iata_code.toUpperCase());
    await popularity.zRem('airport_popularity', iata_code.toUpperCase());

    res.json({ message: 'Aeropuerto eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando aeropuerto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Inicialización del servidor
async function startServer() {
  try {
    await database.connect();
    await database.loadInitialData();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📍 API disponible en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await database.close();
  process.exit(0);
});

// Iniciar servidor
startServer();