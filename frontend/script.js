const API_BASE_URL = 'http://localhost:3000';

let map;
let markersCluster;
let airports = [];

// inicio mapa
function initMap() {
    // centrar mapa
    map = L.map('map').setView([20, 0], 2);

    // Aagregar titulo de openstreetmap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    // inicia los marcadores
    markersCluster = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50
    });

    map.addLayer(markersCluster);
}

// cargar aeropuetos
async function loadAirports() {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE_URL}/airports`);
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        
        airports = await response.json();
        console.log(`carga ${airports.length} aeropuertos`);
        
        displayAirports();
        updateAirportCount();
        
    } catch (error) {
        console.error('Error cargando aeropuertos:', error);
        alert('Error cargando los datos de aeropuertos. fijate que el servidor funcione.');
    } finally {
        showLoading(false);
    }
}

// mostrar en el mapa los aerop
function displayAirports() {
    markersCluster.clearLayers();
    
    airports.forEach(airport => {
        if (airport.lat && airport.lng) {
            const marker = createAirportMarker(airport);
            markersCluster.addLayer(marker);
        }
    });
}

// creo marcador para eropuerto
function createAirportMarker(airport) {
    const marker = L.marker([
        parseFloat(airport.lat),
        parseFloat(airport.lng)
    ]);

    // contenido de la tarjetita que muestro
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

    // cuando clickea q registre la visita para popu
    marker.on('click', async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/airports/${airport.iata_faa}`);
            if (response.ok) {
                console.log(`visita para ${airport.iata_faa}`);
            } else {
                console.error(`Error visita: ${response.status}`);
            }
        } catch (error) {
            console.error('Error registrando visita:', error);
        }
    });

    return marker;
}

// actualizar contador de aerpouetos
function updateAirportCount() {
    const countElement = document.getElementById('airport-count');
    countElement.textContent = `${airports.length} aeropuertos`;
}

// laoding
function showLoading(show) {
    const loadingElement = document.getElementById('loading');
    if (show) {
        loadingElement.classList.remove('hidden');
    } else {
        loadingElement.classList.add('hidden');
    }
}

// carga popu
async function loadPopularAirports() {
    try {
        console.log('cargando populares...');
        const response = await fetch(`${API_BASE_URL}/airports/popular`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const popularAirports = await response.json();
        console.log('populares cargados:', popularAirports);
        displayPopularAirports(popularAirports);
        
    } catch (error) {
        console.error('Error cargando aeropuertos populares:', error);
        
        // mostrar porque mierda no anda
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

// mosrtar populares en el modal
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

// mostrar - esconder modal popu
function showPopularModal() {
    const modal = document.getElementById('popular-modal');
    modal.classList.remove('hidden');
    loadPopularAirports();
}

function hidePopularModal() {
    const modal = document.getElementById('popular-modal');
    modal.classList.add('hidden');
}


document.addEventListener('DOMContentLoaded', () => {
    // iniciar mapa
    initMap();
    
    //carga erop
    loadAirports();
    
    // btn popu
    document.getElementById('popular-btn').addEventListener('click', showPopularModal);
    
    // cerrar
    document.querySelector('.close').addEventListener('click', hidePopularModal);
    
    // cerrar pero toco afuera del modal

    document.getElementById('popular-modal').addEventListener('click', (e) => {
        if (e.target.id === 'popular-modal') {
            hidePopularModal();
        }
    });
    
    // cerra con esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hidePopularModal();
        }
    });
});
