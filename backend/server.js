const express = require('express');
const cors = require('cors');
require('dotenv').config();

const Database = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// instacnair bbdd
const database = new Database();


// listar
app.get('/airports', async (req, res) => {
  try {
    const { airports } = database.getCollections();
    const allAirports = await airports.find({}).toArray();
    res.json(allAirports);
  } catch (error) {
    console.error('Error obteniendo aeropuertos:', error);
    res.status(500).json({ error: 'rror del servidor' });
  }
});

// mas populares
app.get('/airports/popular', async (req, res) => {
  try {
    const { popularity } = database.getRedisClients();
    const { airports } = database.getCollections();

    console.log('buscando populares...');

    // uso este metodo por la version 4 de redis
    const popularData = await popularity.zRangeWithScores('airport_popularity', 0, 9, { REV: true });
    
    console.log('datos de redis', popularData);

    if (popularData.length === 0) {
      console.log('no hay datos de popu');
      return res.json([]);
    }

    const result = [];
    
    for (const item of popularData) {
      const iataCode = item.value;
      const score = item.score;
      
      const airport = await airports.findOne({ iata_faa: iataCode });
      if (airport) {
        result.push({
          ...airport,
          visits: parseInt(score)
        });
        console.log(`encontre: ${airport.name}`);
      } else {
        console.log(`no encontre ${iataCode}`);
      }
    }

    console.log(`devuelvo ${result.length} populares`);
    res.json(result);
  } catch (error) {
    console.error('error al obtener populares:', error);
    res.status(500).json({ error: 'error del servidor' });
  }
});





// CONSULTAS

// bucsar cercanos
app.get('/airports/nearby', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng || !radius) {
      return res.status(400).json({ error: 'necesito los parametros maquina: lat, lng, radius' });
    }

    const { geo } = database.getRedisClients();
    const { airports } = database.getCollections();

    console.log(`buscando cerca de ${lat}, ${lng} en radio ${radius}km`);

    // aca tuve que buscar porque jodia con la sintaxis en la version 4 chota
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

    console.log('cercanos encontrados:', nearbyIataCodes);

    if (nearbyIataCodes.length === 0) {
      return res.json([]);
    }

    // saco codigo IATA
    const codes = nearbyIataCodes.map(item => item.member);

    // traigo detalle 
    const nearbyAirports = await airports.find({
      iata_faa: { $in: codes }
    }).toArray();

    console.log(`devuelvo ${nearbyAirports.length} aeropuertos cercanos`);
    res.json(nearbyAirports);
  } catch (error) {
    console.error('error buscando aeropuertos cerca:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// traer especifico y aumenta la popularidad
app.get('/airports/:iata_code', async (req, res) => {
  try {
    const { iata_code } = req.params;
    const { airports } = database.getCollections();
    const { popularity } = database.getRedisClients();

    const airport = await airports.findOne({ iata_faa: iata_code.toUpperCase() });
    
    if (!airport) {
      return res.status(404).json({ error: 'Aeropuerto no encontrado' });
    }

    // sube popu
    await popularity.zIncrBy('airport_popularity', 1, iata_code.toUpperCase());

    res.json(airport);
  } catch (error) {
    console.error('error obteniendo aeropuerto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// nuevo
app.post('/airports', async (req, res) => {
  try {
    const airportData = req.body;
    const { airports } = database.getCollections();
    const { geo } = database.getRedisClients();

    // Vvalido datos
    if (!airportData.iata_faa || !airportData.lat || !airportData.lng) {
      return res.status(400).json({ error: 'Faltan datos requeridos: iata_faa, lat, lng' });
    }

    // ver q no exista 
    const existing = await airports.findOne({ iata_faa: airportData.iata_faa.toUpperCase() });
    if (existing) {
      return res.status(409).json({ error: 'El aeropuerto ya existe' });
    }

    // guardo en mongo
    airportData.iata_faa = airportData.iata_faa.toUpperCase();
    const result = await airports.insertOne(airportData);

    // agrego a geo
    await geo.geoAdd('airports-geo', {
      longitude: parseFloat(airportData.lng),
      latitude: parseFloat(airportData.lat),
      member: airportData.iata_faa
    });

    res.status(201).json({ ...airportData, _id: result.insertedId });
  } catch (error) {
    console.error('error creando aeropuerto:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// actualizar 
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

    // cambiar las coordenadas si las cambiaron
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
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// borrar
app.delete('/airports/:iata_code', async (req, res) => {
  try {
    const { iata_code } = req.params;
    const { airports } = database.getCollections();
    const { geo, popularity } = database.getRedisClients();

    const result = await airports.deleteOne({ iata_faa: iata_code.toUpperCase() });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Aeropuerto no encontrado' });
    }

    // borro de geo y la popularidad
    await geo.zRem('airports-geo', iata_code.toUpperCase());
    await popularity.zRem('airport_popularity', iata_code.toUpperCase());

    res.json({ message: 'Aeropuerto eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando aeropuerto:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// levanta server
async function startServer() {
  try {
    await database.connect();
    await database.loadInitialData();

    app.listen(PORT, () => {
      console.log(`server en puerto ${PORT}`);
      console.log(`api en http://localhost:${PORT}`);
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