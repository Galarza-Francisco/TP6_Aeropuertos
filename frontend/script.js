// Configuración de la API
const API_BASE_URL = 'http://localhost:3000';

// Variables globales
let map;
let markersCluster;
let airports = [];

// Inicialización del mapa
function initMap() {
    // Crear el mapa centrado en el mundo
    map = L.map('map').setView([20, 0], 2);

    // Agregar tile layer de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    // Inicializar cluster de marcadores
    markersCluster = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50
    });

    map.addLayer(markersCluster);
}

// Cargar aeropuertos desde la API
async function loadAirports() {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE_URL}/airports`);
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        
        airports = await response.json();
        console.log(`Cargados ${airports.length} aeropuertos`);
        
        displayAirports();
        updateAirportCount();
        
    } catch (error) {
        console.error('Error cargando aeropuertos:', error);
        alert('Error cargando los datos de aeropuertos. Verifique que el servidor esté funcionando.');
    } finally {
        showLoading(false);
    }
}

// Mostrar aeropuertos en el mapa
function displayAirports() {
    markersCluster.clearLayers();
    
    airports.forEach(airport => {
        if (airport.lat && airport.lng) {
            const marker = createAirportMarker(airport);
            markersCluster.addLayer(marker);
        }
    });
}

// Crear marcador para un aeropuerto
function createAirportMarker(airport) {
    const marker = L.marker([
        parseFloat(airport.lat),
        parseFloat(airport.lng)
    ]);

    // Contenido del popup - verificar campos disponibles
    const popupContent = `
        <div class="airport-popup">
            <div class="iata-code">${airport.iata_faa || 'N/A'}</div>
            <h3>${airport.name || 'Nombre no disponible'}</h3>
            <p><strong>Ciudad:</strong> ${airport.city || 'N/A'}</p>
            <p><strong>Coordenadas:</strong> ${airport.lat}, ${airport.lng}</p>
            ${airport.alt ? `<p><strong>Altitud:</strong> ${airport.alt}m</p>` : ''}
            ${airport.icao ? `<p><strong>ICAO:</strong> ${airport.icao}</p>` : ''}
            ${airport.tz ? `<p><strong>Zona horaria:</strong> ${airport.tz}</p>` : ''}
        </div>
    `;

    marker.bindPopup(popupContent);

    // Al hacer clic, registrar visita
    marker.on('click', async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/airports/${airport.iata_faa}`);
            if (response.ok) {
                console.log(`Visita registrada para ${airport.iata_faa}`);
            } else {
                console.error(`Error registrando visita: ${response.status}`);
            }
        } catch (error) {
            console.error('Error registrando visita:', error);
        }
    });

    return marker;
}

// Actualizar contador de aeropuertos
function updateAirportCount() {
    const countElement = document.getElementById('airport-count');
    countElement.textContent = `${airports.length} aeropuertos`;
}

// Mostrar/ocultar loading
function showLoading(show) {
    const loadingElement = document.getElementById('loading');
    if (show) {
        loadingElement.classList.remove('hidden');
    } else {
        loadingElement.classList.add('hidden');
    }
}

// Cargar aeropuertos populares
async function loadPopularAirports() {
    try {
        console.log('Cargando aeropuertos populares...');
        const response = await fetch(`${API_BASE_URL}/airports/popular`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const popularAirports = await response.json();
        console.log('Aeropuertos populares cargados:', popularAirports);
        displayPopularAirports(popularAirports);
        
    } catch (error) {
        console.error('Error cargando aeropuertos populares:', error);
        
        // Mostrar error más específico
        const listElement = document.getElementById('popular-list');
        listElement.innerHTML = `
            <div style="text-align: center; color: #666; padding: 2rem;">
                <h3>Error cargando estadísticas</h3>
                <p>Error: ${error.message}</p>
                <p>Verifica que el backend esté funcionando en puerto 3000</p>
                <button onclick="loadPopularAirports()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Reintentar
                </button>
            </div>
        `;
    }
}

// Mostrar aeropuertos populares en modal
function displayPopularAirports(popularAirports) {
    const listElement = document.getElementById('popular-list');
    
    if (popularAirports.length === 0) {
        listElement.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No hay estadísticas de popularidad disponibles aún.</p>';
        return;
    }
    
    listElement.innerHTML = popularAirports.map((airport, index) => `
        <div class="popular-item">
            <div class="airport-info">
                <h3>#${index + 1} ${airport.name || airport.iata_faa}</h3>
                <p>${airport.city || 'Ciudad no disponible'}</p>
                <p><strong>Código IATA:</strong> ${airport.iata_faa}</p>
            </div>
            <div class="visit-count">
                ${airport.visits} ${airport.visits === 1 ? 'visita' : 'visitas'}
            </div>
        </div>
    `).join('');
}

// Mostrar modal de aeropuertos populares
function showPopularModal() {
    const modal = document.getElementById('popular-modal');
    modal.classList.remove('hidden');
    loadPopularAirports();
}

// Ocultar modal
function hidePopularModal() {
    const modal = document.getElementById('popular-modal');
    modal.classList.add('hidden');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar mapa
    initMap();
    
    // Cargar aeropuertos
    loadAirports();
    
    // Botón de aeropuertos populares
    document.getElementById('popular-btn').addEventListener('click', showPopularModal);
    
    // Cerrar modal
    document.querySelector('.close').addEventListener('click', hidePopularModal);
    
    // Cerrar modal al hacer clic fuera del contenido
    document.getElementById('popular-modal').addEventListener('click', (e) => {
        if (e.target.id === 'popular-modal') {
            hidePopularModal();
        }
    });
    
    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hidePopularModal();
        }
    });
});

// Funciones auxiliares para debugging
window.searchNearby = async function(lat, lng, radius = 100) {
    try {
        const response = await fetch(`${API_BASE_URL}/airports/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
        const nearby = await response.json();
        console.log(`Aeropuertos cercanos a ${lat}, ${lng} (${radius}km):`, nearby);
        return nearby;
    } catch (error) {
        console.error('Error buscando aeropuertos cercanos:', error);
    }
};

window.getAirportInfo = async function(iataCode) {
    try {
        const response = await fetch(`${API_BASE_URL}/airports/${iataCode}`);
        const airport = await response.json();
        console.log(`Información de ${iataCode}:`, airport);
        return airport;
    } catch (error) {
        console.error('Error obteniendo información del aeropuerto:', error);
    }
};