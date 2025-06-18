const { MongoClient } = require('mongodb');
const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.mongo = null;
    this.db = null;
    this.redisGeo = null;
    this.redisPop = null;
  }

  async connect() {
    try {
      // conectar mongo
      const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/airport_db';
      this.mongo = new MongoClient(mongoUrl);
      await this.mongo.connect();
      this.db = this.mongo.db('airport_db');
      console.log('mongo ok');

      // georeds
      const redisGeoUrl = process.env.REDIS_GEO_URL || 'redis://localhost:6379';
      this.redisGeo = createClient({ url: redisGeoUrl });
      await this.redisGeo.connect();
      console.log('geo redis ok');

      // redis populares
      const redisPopUrl = process.env.REDIS_POP_URL || 'redis://localhost:6380';
      this.redisPop = createClient({ url: redisPopUrl });
      await this.redisPop.connect();
      console.log('redis popu ok');

      // la poplaridad vence cada un dia
      await this.redisPop.expire('airport_popularity', 86400);
      return true;
    } catch (error) {
      console.error('❌ Error conectando a las bases de datos:', error);
      throw error;
    }
  }

  
  async loadInitialData() {
    try {
      const collection = this.db.collection('airports');
      const count = await collection.countDocuments();
      
      if (count > 0) {
        console.log('📊 Datos ya cargados en MongoDB');
        return;
      }

      const dataPath = path.join(__dirname, 'data', 'data_trasport.json');
      if (!fs.existsSync(dataPath)) {
        console.log('⚠️  Archivo data_trasport.json no encontrado');
        return;
      }

      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      console.log(`📥 Cargando ${data.length} aeropuertos...`);

      // Cargar en MongoDB
      await collection.insertMany(data);

      // Cargar en Redis GEO
      for (const airport of data) {
        if (airport.lat && airport.lng && airport.iata_faa) {
          await this.redisGeo.geoAdd('airports-geo', {
            longitude: parseFloat(airport.lng),
            latitude: parseFloat(airport.lat),
            member: airport.iata_faa
          });
        }
      }

      console.log('✅ Datos iniciales cargados correctamente');
    } catch (error) {
      console.error('❌ Error cargando datos iniciales:', error);
      throw error;
    }
  }

  getCollections() {
    return {
      airports: this.db.collection('airports')
    };
  }

  getRedisClients() {
    return {
      geo: this.redisGeo,
      popularity: this.redisPop
    };
  }

  async close() {
    if (this.mongo) await this.mongo.close();
    if (this.redisGeo) await this.redisGeo.quit();
    if (this.redisPop) await this.redisPop.quit();
  }
}

module.exports = Database;