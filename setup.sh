#!/bin/bash

echo "🛩️  Configurando proyecto API Aeropuertos"
echo "========================================"

# Verificar si el archivo de datos existe
if [ ! -f "data_transport.json" ]; then
    echo "❌ Archivo data_transport.json no encontrado en el directorio actual"
    echo "💡 Asegúrate de estar en el directorio del repositorio donde está el archivo"
    exit 1
fi

# Crear directorio data si no existe y copiar archivo
mkdir -p data
cp data_transport.json data/
echo "✅ Archivo de datos copiado a data/data_transport.json"

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor instálalo primero."
    exit 1
fi

# Verificar si Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado. Por favor instálalo primero."
    exit 1
fi

echo "✅ Docker y Docker Compose están disponibles"

# Construir y ejecutar los contenedores
echo "🔨 Construyendo contenedores..."
docker-compose build

echo "🚀 Iniciando servicios..."
docker-compose up -d

echo "⏳ Esperando que los servicios estén listos..."
sleep 10

# Verificar que los servicios estén corriendo
echo "🔍 Verificando servicios..."

if docker-compose ps | grep -q "Up"; then
    echo "✅ Servicios iniciados correctamente"
    echo ""
    echo "🌐 Aplicación disponible en:"
    echo "   Frontend: http://localhost:8080"
    echo "   API Backend: http://localhost:3000"
    echo ""
    echo "📊 Servicios de base de datos:"
    echo "   MongoDB: localhost:27017"
    echo "   Redis GEO: localhost:6379"
    echo "   Redis Popularidad: localhost:6380"
    echo ""
    echo "🎯 Endpoints principales:"
    echo "   GET  http://localhost:3000/airports"
    echo "   GET  http://localhost:3000/airports/{iata_code}"
    echo "   POST http://localhost:3000/airports"
    echo "   GET  http://localhost:3000/airports/nearby?lat=X&lng=Y&radius=Z"
    echo "   GET  http://localhost:3000/airports/popular"
    echo ""
    echo "📱 ¡Abre tu navegador en http://localhost:8080 para ver el mapa!"
else
    echo "❌ Error iniciando los servicios"
    echo "📋 Estado de los contenedores:"
    docker-compose ps
    echo ""
    echo "📋 Logs del backend:"
    docker-compose logs backend
fi