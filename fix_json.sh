#!/bin/bash

echo "🔧 Convirtiendo data_trasport.json a formato válido..."

# Verificar que el archivo existe
if [ ! -f "data_trasport.json" ]; then
    echo "❌ Archivo data_trasport.json no encontrado"
    exit 1
fi

# Crear backup
cp data_trasport.json data_trasport.json.backup
echo "📋 Backup creado: data_trasport.json.backup"

# Convertir el archivo a JSON válido
echo "🔄 Convirtiendo formato..."

# Agregar corchetes y comas
{
    echo "["
    sed 's/^[[:space:]]*{/  {/g' data_trasport.json | \
    sed 's/^[[:space:]]*}/  }/g' | \
    sed 'N;s/}\n[[:space:]]*{/},\n  {/g' | \
    sed '$!s/}$/},/'
    echo "]"
} > data_transport_fixed.json

# Verificar que el JSON es válido
if command -v node &> /dev/null; then
    echo "✅ Verificando JSON con Node.js..."
    if node -e "JSON.parse(require('fs').readFileSync('data_transport_fixed.json', 'utf8')); console.log('JSON válido!')"; then
        mv data_transport_fixed.json data_trasport.json
        echo "✅ Archivo convertido exitosamente"
        
        # Mostrar estadísticas
        RECORDS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('data_trasport.json', 'utf8')).length)")
        echo "📊 Total de aeropuertos: $RECORDS"
    else
        echo "❌ Error en la conversión, JSON inválido"
        echo "🔄 Intentando método alternativo..."
        rm data_transport_fixed.json
        
        # Método alternativo más simple
        awk 'BEGIN{print "["} /^[[:space:]]*{/{if(first)print ","; first=1} {print} END{print "]"}' data_trasport.json > data_transport_fixed.json
        
        if node -e "JSON.parse(require('fs').readFileSync('data_transport_fixed.json', 'utf8')); console.log('JSON válido!')"; then
            mv data_transport_fixed.json data_trasport.json
            echo "✅ Archivo convertido exitosamente (método alternativo)"
        else
            echo "❌ No se pudo convertir automáticamente"
            echo "💡 Necesitas arreglar el archivo manualmente"
            rm data_transport_fixed.json
        fi
    fi
elif command -v python3 &> /dev/null; then
    echo "✅ Verificando JSON con Python..."
    if python3 -c "import json; json.load(open('data_transport_fixed.json'))"; then
        mv data_transport_fixed.json data_trasport.json
        echo "✅ Archivo convertido exitosamente"
    else
        echo "❌ Error en la conversión"
        rm data_transport_fixed.json
    fi
else
    echo "⚠️  No se puede verificar automáticamente"
    echo "📝 Verifica manualmente que data_transport_fixed.json sea válido"
    echo "💡 Luego ejecuta: mv data_transport_fixed.json data_trasport.json"
fi

echo "✅ Proceso completado"