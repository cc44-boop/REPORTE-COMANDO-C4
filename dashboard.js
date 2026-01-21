// ===== DASHBOARD COMPLETO - Carga automática desde Supabase =====

// Variables globales
let map = null;
let leaderChart = null;
let cityChart = null;
let currentMarkers = [];
let politicalData = [];
let filteredData = [];
let autoRefreshInterval = null;

// Mapeo de columnas (INCLUYENDO TELÉFONO)
const COLUMN_MAP = {
    'lider': 'lider',
    'líder': 'lider',
    'nombre': 'nombre',
    'apellidos': 'apellidos',
    'cedula': 'cedula',
    'cédula': 'cedula',
    'ciudad': 'ciudad',
    'puesto de votacion': 'puestoVotacion',
    'puesto_votacion': 'puestoVotacion',
    'puesto': 'puestoVotacion',
    'puesto_de_votacion': 'puestoVotacion',
    'mesa': 'mesa',
    'latitud': 'latitud',
    'lat': 'latitud',
    'longitud': 'longitud',
    'long': 'longitud',
    'reporto voto': 'reportoVoto',
    'voto': 'reportoVoto',
    'reportado': 'reportoVoto',
    'telefono': 'telefono',
    'teléfono': 'telefono',
    'celular': 'telefono',
    'cel': 'telefono',
    'phone': 'telefono',
    'tel': 'telefono',
    'contacto': 'telefono'
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Inicializando dashboard desde Supabase...');

    // Inicializar mapa
    initializeMap();

    // Configurar eventos
    setupEventListeners();

    // Cargar datos por primera vez desde Supabase
    loadDataFromSupabase();

    // Configurar actualización automática cada 15 segundos
    autoRefreshInterval = setInterval(loadDataFromSupabase, 15000);

    console.log('✅ Dashboard inicializado. Se cargará desde Supabase.');
});

// ===== CARGAR DATOS DESDE SUPABASE =====
async function loadDataFromSupabase() {
    console.log('📥 Intentando cargar datos desde Supabase...');

    updateStatus('Cargando datos desde Supabase...', 'info');

    try {
        const { data, error } = await supabaseClient
            .from("votos")
            .select("*");

        if (error) {
            throw new Error(`Error en Supabase: ${error.message}`);
        }

        // Procesar datos (normaliza campos, parsea números, etc.)
        politicalData = processSupabaseData(data);
        filteredData = [...politicalData];

        // Actualizar UI
        updateDashboard();
        updateLastUpdateTime();
        updateStatus(`✅ Datos cargados: ${politicalData.length} registros`, 'success');

        console.log(`✅ ${politicalData.length} registros cargados desde Supabase`);
        console.log('📱 Columnas disponibles:', Object.keys(politicalData[0] || {}));

    } catch (error) {
        console.error('❌ Error cargando desde Supabase:', error);
        updateStatus(`❌ Error: ${error.message}`, 'error');
        showErrorMessage(error.message);
    }
}

// ===== PROCESAR DATOS DE SUPABASE (igual que antes, pero sin Excel) =====
function processSupabaseData(rawData) {
    console.log('🔄 Procesando datos de Supabase...');

    const processedData = [];

    rawData.forEach((row, index) => {
        try {
            const item = {};

            // Normalizar claves usando COLUMN_MAP
            Object.keys(row).forEach(originalKey => {
                const key = originalKey.toLowerCase().trim();
                const mappedKey = COLUMN_MAP[key] || key;

                let value = row[originalKey];

                // Parsear según tipo
                if (mappedKey === 'latitud' || mappedKey === 'longitud') {
                    // Convertir comas a puntos y luego a número
                    value = parseFloat(String(value).replace(',', '.')) || 0;
                } else if (mappedKey === 'reportoVoto') {
                    // Soportar booleanos o strings
                    if (typeof value === 'boolean') {
                        // ok
                    } else {
                        const strValue = String(value).toLowerCase().trim();
                        value = ['si', 'sí', 'true', '1', 'yes', 'verdadero'].includes(strValue);
                    }
                } else if (mappedKey === 'cedula' || mappedKey === 'mesa') {
                    value = String(value).trim();
                } else if (mappedKey === 'telefono') {
                    value = formatPhoneNumber(String(value).trim());
                } else {
                    value = String(value).trim();
                }

                item[mappedKey] = value;
            });

            // Solo agregar si tiene cédula y nombre/apellidos
            if (item.cedula && (item.nombre || item.apellidos)) {
                processedData.push(item);
            }

        } catch (error) {
            console.warn(`⚠️ Error en registro ${index + 1}:`, error);
        }
    });

    console.log(`📊 ${processedData.length} registros procesados`);
    return processedData;
}

// ===== FORMATEAR NÚMERO DE TELÉFONO =====
function formatPhoneNumber(phone) {
    if (!phone) return '';

    let cleanPhone = phone.replace(/\D/g, '');

    if (cleanPhone.startsWith('57') && cleanPhone.length === 12) {
        return `+${cleanPhone.substring(0, 2)} ${cleanPhone.substring(2, 5)} ${cleanPhone.substring(5, 8)} ${cleanPhone.substring(8)}`;
    }

    if (cleanPhone.length === 10) {
        return `+57 ${cleanPhone.substring(0, 3)} ${cleanPhone.substring(3, 6)} ${cleanPhone.substring(6)}`;
    }

    return phone;
}

// ===== INICIALIZAR MAPA =====
function initializeMap() {
    try {
        map = L.map('map').setView([4.5709, -74.2973], 6);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        L.marker([4.5709, -74.2973])
            .bindPopup('<h5>Dashboard Político</h5><p>Cargando datos desde Supabase...</p>')
            .addTo(map);

        console.log('🗺️ Mapa inicializado');

    } catch (error) {
        console.error('❌ Error con el mapa:', error);
        document.getElementById('map').innerHTML = `
            <div class="alert alert-warning m-3">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Error cargando el mapa</strong>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// ===== ACTUALIZAR TODO EL DASHBOARD =====
function updateDashboard() {
    if (!politicalData.length) {
        showErrorMessage('No hay datos en Supabase');
        return;
    }

    const hasTelefono = politicalData.some(item => item.telefono);
    console.log(`📱 ¿Hay datos de teléfono?: ${hasTelefono ? 'SÍ' : 'NO'}`);

    updateTableHeaders(hasTelefono);
    updateStatistics();
    updateDataTable(hasTelefono);
    updateMap(hasTelefono);
    updateCharts();
    setupFilters();
    enableControls();

    document.getElementById('total-loaded').textContent = politicalData.length;
}

// ===== ACTUALIZAR ENCABEZADOS DE TABLA =====
function updateTableHeaders(hasTelefono) {
    const thead = document.querySelector('#data-table thead');
    if (!thead) return;

    if (hasTelefono) {
        thead.innerHTML = `
            <tr>
                <th><i class="fas fa-user-tie"></i> Líder</th>
                <th><i class="fas fa-user"></i> Nombre</th>
                <th><i class="fas fa-id-card"></i> Cédula</th>
                <th><i class="fas fa-phone"></i> Teléfono</th>
                <th><i class="fas fa-city"></i> Ciudad</th>
                <th><i class="fas fa-school"></i> Puesto</th>
                <th><i class="fas fa-chair"></i> Mesa</th>
                <th><i class="fas fa-vote-yea"></i> Voto</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr>
                <th><i class="fas fa-user-tie"></i> Líder</th>
                <th><i class="fas fa-user"></i> Nombre</th>
                <th><i class="fas fa-id-card"></i> Cédula</th>
                <th><i class="fas fa-city"></i> Ciudad</th>
                <th><i class="fas fa-school"></i> Puesto</th>
                <th><i class="fas fa-chair"></i> Mesa</th>
                <th><i class="fas fa-vote-yea"></i> Voto</th>
            </tr>
        `;
    }
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function updateStatistics() {
    const totalLideres = new Set(politicalData.map(d => d.lider)).size;
    const votosReportados = politicalData.filter(d => d.reportoVoto).length;
    const totalCiudades = new Set(politicalData.map(d => d.ciudad)).size;
    const porcentajeReportado = ((votosReportados / politicalData.length) * 100).toFixed(1);

    document.getElementById('total-registros').textContent = politicalData.length;
    document.getElementById('votos-reportados').textContent = votosReportados;
    document.getElementById('total-ciudades').textContent = totalCiudades;
    document.getElementById('porcentaje-reportado').textContent = porcentajeReportado + '%';
    document.getElementById('total-lideres').textContent = totalLideres;

    document.querySelectorAll('.stat-number').forEach(el => {
        el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 1000);
    });
}

// ===== ACTUALIZAR TABLA (CON TELÉFONO) =====
function updateDataTable(hasTelefono) {
    const tbody = document.getElementById('table-body');
    const loadingRow = document.getElementById('loading-row');
    const tableCount = document.getElementById('table-count');

    if (loadingRow) loadingRow.remove();
    tbody.innerHTML = '';

    filteredData.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        row.style.animationDelay = `${index * 0.05}s`;

        if (hasTelefono) {
            row.innerHTML = `
                <td>${item.lider || 'N/A'}</td>
                <td><strong>${item.nombre || ''} ${item.apellidos || ''}</strong></td>
                <td><code>${item.cedula || 'N/A'}</code></td>
                <td>
                    ${item.telefono ? `
                        <a href="tel:${item.telefono.replace(/\s/g, '')}" class="text-decoration-none">
                            <i class="fas fa-phone text-success"></i> ${item.telefono}
                        </a>
                    ` : '<span class="text-muted">N/A</span>'}
                </td>
                <td>${item.ciudad || 'N/A'}</td>
                <td>${item.puestoVotacion || 'N/A'}</td>
                <td><span class="badge bg-info">${item.mesa || 'N/A'}</span></td>
                <td>
                    <span class="badge ${item.reportoVoto ? 'bg-success' : 'bg-danger'}">
                        ${item.reportoVoto ? 'Sí' : 'No'}
                    </span>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td>${item.lider || 'N/A'}</td>
                <td><strong>${item.nombre || ''} ${item.apellidos || ''}</strong></td>
                <td><code>${item.cedula || 'N/A'}</code></td>
                <td>${item.ciudad || 'N/A'}</td>
                <td>${item.puestoVotacion || 'N/A'}</td>
                <td><span class="badge bg-info">${item.mesa || 'N/A'}</span></td>
                <td>
                    <span class="badge ${item.reportoVoto ? 'bg-success' : 'bg-danger'}">
                        ${item.reportoVoto ? 'Sí' : 'No'}
                    </span>
                </td>
            `;
        }

        row.addEventListener('click', () => {
            if (item.latitud && item.longitud) {
                focusOnMap(item.latitud, item.longitud, item, hasTelefono);
            }
        });

        tbody.appendChild(row);
    });

    tableCount.textContent = `${filteredData.length} registros`;
}

// ===== ACTUALIZAR MAPA (CON TELÉFONO) =====
function updateMap(hasTelefono) {
    if (!map) return;

    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];

    filteredData.forEach(item => {
        if (item.latitud && item.longitud && item.latitud !== 0 && item.longitud !== 0) {
            const markerColor = item.reportoVoto ? '#28a745' : '#dc3545';

            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    background-color: ${markerColor};
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            const marker = L.marker([item.latitud, item.longitud], { icon })
                .bindPopup(createPopupContent(item, hasTelefono));

            marker.addTo(map);
            currentMarkers.push(marker);
        }
    });

    if (currentMarkers.length > 0) {
        const bounds = L.latLngBounds(currentMarkers.map(m => m.getLatLng()));
        map.fitBounds(bounds.pad(0.1));
    }
}

// ===== CREAR CONTENIDO PARA POPUP (CON TELÉFONO) =====
function createPopupContent(item, hasTelefono) {
    let telefonoHtml = '';

    if (hasTelefono && item.telefono) {
        telefonoHtml = `
            <tr>
                <td style="padding: 3px 0;"><strong><i class="fas fa-phone"></i> Teléfono:</strong></td>
                <td style="padding: 3px 0; text-align: right;">
                    <a href="tel:${item.telefono.replace(/\s/g, '')}" 
                       style="color: #3498db; text-decoration: none;">
                        ${item.telefono}
                    </a>
                </td>
            </tr>
        `;
    }

    return `
        <div style="min-width: 250px; font-family: 'Segoe UI', sans-serif;">
            <h5 style="color: #2c3e50; margin-bottom: 10px; border-bottom: 2px solid #3498db; padding-bottom: 5px;">
                <i class="fas fa-user"></i> ${item.nombre || ''} ${item.apellidos || ''}
            </h5>
            
            <table style="width: 100%; font-size: 13px;">
                <tr>
                    <td style="padding: 3px 0;"><strong><i class="fas fa-id-card"></i> Cédula:</strong></td>
                    <td style="padding: 3px 0; text-align: right;">${item.cedula || 'N/A'}</td>
                </tr>
                ${telefonoHtml}
                <tr>
                    <td style="padding: 3px 0;"><strong><i class="fas fa-user-tie"></i> Líder:</strong></td>
                    <td style="padding: 3px 0; text-align: right;">${item.lider || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 3px 0;"><strong><i class="fas fa-city"></i> Ciudad:</strong></td>
                    <td style="padding: 3px 0; text-align: right;">${item.ciudad || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 3px 0;"><strong><i class="fas fa-school"></i> Puesto:</strong></td>
                    <td style="padding: 3px 0; text-align: right;">${item.puestoVotacion || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 3px 0;"><strong><i class="fas fa-chair"></i> Mesa:</strong></td>
                    <td style="padding: 3px 0; text-align: right;"><strong>${item.mesa || 'N/A'}</strong></td>
                </tr>
            </table>
            
            <div style="margin-top: 10px; padding: 8px; border-radius: 5px; background-color: ${
                item.reportoVoto ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)'
            }; border-left: 4px solid ${item.reportoVoto ? '#28a745' : '#dc3545'}">
                <table style="width: 100%;">
                    <tr>
                        <td><strong><i class="fas fa-vote-yea"></i> Voto:</strong></td>
                        <td style="text-align: right;">
                            <strong style="color: ${item.reportoVoto ? '#28a745' : '#dc3545'}">
                                ${item.reportoVoto ? 'REPORTADO' : 'NO REPORTADO'}
                            </strong>
                        </td>
                    </tr>
                </table>
            </div>
            
            ${item.telefono ? `
            <div style="margin-top: 10px; text-align: center;">
                <a href="tel:${item.telefono.replace(/\s/g, '')}" 
                   style="display: inline-block; padding: 8px 15px; background: #28a745; color: white; 
                          text-decoration: none; border-radius: 5px; font-weight: bold;">
                    <i class="fas fa-phone"></i> Llamar
                </a>
            </div>
            ` : ''}
        </div>
    `;
}

// ===== ENFOCAR EN MAPA (CON TELÉFONO) =====
function focusOnMap(lat, lng, item, hasTelefono) {
    if (!map) return;

    map.setView([lat, lng], 15);

    L.popup()
        .setLatLng([lat, lng])
        .setContent(createPopupContent(item, hasTelefono))
        .openOn(map);
}

// ===== ACTUALIZAR GRÁFICOS =====
function updateCharts() {
    if (leaderChart) leaderChart.destroy();
    if (cityChart) cityChart.destroy();

    const leaderData = prepareLeaderChartData();
    const cityData = prepareCityChartData();

    createLeaderChart(leaderData);
    createCityChart(cityData);
}

function prepareLeaderChartData() {
    const leaderStats = {};

    filteredData.forEach(item => {
        if (item.lider) {
            if (!leaderStats[item.lider]) {
                leaderStats[item.lider] = { total: 0, reported: 0 };
            }
            leaderStats[item.lider].total++;
            if (item.reportoVoto) {
                leaderStats[item.lider].reported++;
            }
        }
    });

    return {
        labels: Object.keys(leaderStats),
        totals: Object.values(leaderStats).map(stat => stat.total),
        reported: Object.values(leaderStats).map(stat => stat.reported)
    };
}

function prepareCityChartData() {
    const cityStats = {};

    filteredData.forEach(item => {
        if (item.ciudad) {
            if (!cityStats[item.ciudad]) {
                cityStats[item.ciudad] = { total: 0, reported: 0 };
            }
            cityStats[item.ciudad].total++;
            if (item.reportoVoto) {
                cityStats[item.ciudad].reported++;
            }
        }
    });

    return {
        labels: Object.keys(cityStats),
        totals: Object.values(cityStats).map(stat => stat.total),
        reported: Object.values(cityStats).map(stat => stat.reported)
    };
}

function createLeaderChart(data) {
    const ctx = document.getElementById('leader-chart');
    if (!ctx) return;

    leaderChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.totals,
                backgroundColor: [
                    '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
                    '#1abc9c', '#d35400', '#c0392b', '#16a085', '#8e44ad'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { size: 11 } }
                }
            }
        }
    });
}

function createCityChart(data) {
    const ctx = document.getElementById('city-chart');
    if (!ctx) return;

    cityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Votos Reportados',
                    data: data.reported,
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Votos Totales',
                    data: data.totals,
                    backgroundColor: 'rgba(52, 152, 219, 0.5)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// ===== CONFIGURAR FILTROS =====
function setupFilters() {
    const ciudades = [...new Set(politicalData.map(d => d.ciudad).filter(Boolean))].sort();
    const lideres = [...new Set(politicalData.map(d => d.lider).filter(Boolean))].sort();
    const mesas = [...new Set(politicalData.map(d => d.mesa).filter(Boolean))].sort((a, b) => a - b);

    fillSelect('filter-ciudad', ciudades);
    fillSelect('filter-lider', lideres);
    fillSelect('filter-mesa', mesas);
}

function fillSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Todos</option>';

    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });

    if (currentValue && options.includes(currentValue)) {
        select.value = currentValue;
    }

    select.disabled = false;
}

// ===== APLICAR FILTROS =====
function applyFilters() {
    const ciudad = document.getElementById('filter-ciudad').value;
    const lider = document.getElementById('filter-lider').value;
    const voto = document.getElementById('filter-voto').value;
    const mesa = document.getElementById('filter-mesa').value;

    filteredData = politicalData.filter(item => {
        if (ciudad && item.ciudad !== ciudad) return false;
        if (lider && item.lider !== lider) return false;
        if (mesa && item.mesa !== mesa) return false;
        if (voto !== '') {
            const votoBool = voto === 'true';
            if (item.reportoVoto !== votoBool) return false;
        }
        return true;
    });

    const hasTelefono = politicalData.some(item => item.telefono);
    updateDataTable(hasTelefono);
    updateMap(hasTelefono);
    updateCharts();
}

// ===== RESETAR FILTROS =====
function resetFilters() {
    document.getElementById('filter-ciudad').value = '';
    document.getElementById('filter-lider').value = '';
    document.getElementById('filter-voto').value = '';
    document.getElementById('filter-mesa').value = '';

    filteredData = [...politicalData];
    const hasTelefono = politicalData.some(item => item.telefono);
    updateDataTable(hasTelefono);
    updateMap(hasTelefono);
    updateCharts();
}

// ===== EXPORTAR DATOS (CON TELÉFONO) =====
function exportData() {
    const hasTelefono = politicalData.some(item => item.telefono);

    let headers = ['Líder', 'Nombre', 'Apellidos', 'Cédula', 'Ciudad', 'Puesto de Votación', 'Mesa', 'Latitud', 'Longitud', 'Reportó Voto'];
    if (hasTelefono) {
        headers.splice(4, 0, 'Teléfono');
    }

    let csv = headers.join(',') + '\n';

    filteredData.forEach(item => {
        let row = [
            `"${item.lider || ''}"`,
            `"${item.nombre || ''}"`,
            `"${item.apellidos || ''}"`,
            `"${item.cedula || ''}"`
        ];

        if (hasTelefono) {
            row.push(`"${item.telefono || ''}"`);
        }

        row.push(
            `"${item.ciudad || ''}"`,
            `"${item.puestoVotacion || ''}"`,
            `"${item.mesa || ''}"`,
            item.latitud || 0,
            item.longitud || 0,
            item.reportoVoto ? 'SI' : 'NO'
        );

        csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `datos_politicos_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    showNotification(`Datos exportados: ${filteredData.length} registros`, 'success');
}

// ===== HABILITAR CONTROLES =====
function enableControls() {
    const controls = [
        'filter-ciudad', 'filter-lider', 'filter-mesa',
        'reset-filters', 'export-data', 'refresh-data'
    ];

    controls.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = false;
    });
}

// ===== CONFIGURAR EVENTOS =====
function setupEventListeners() {
    document.getElementById('filter-ciudad')?.addEventListener('change', applyFilters);
    document.getElementById('filter-lider')?.addEventListener('change', applyFilters);
    document.getElementById('filter-voto')?.addEventListener('change', applyFilters);
    document.getElementById('filter-mesa')?.addEventListener('change', applyFilters);

    document.getElementById('reset-filters')?.addEventListener('click', resetFilters);
    document.getElementById('export-data')?.addEventListener('click', exportData);
    document.getElementById('refresh-data')?.addEventListener('click', loadDataFromSupabase);

    document.getElementById('zoom-in')?.addEventListener('click', () => map && map.zoomIn());
    document.getElementById('zoom-out')?.addEventListener('click', () => map && map.zoomOut());
    document.getElementById('reset-map')?.addEventListener('click', () => {
        if (!map) return;
        if (currentMarkers.length > 0) {
            const bounds = L.latLngBounds(currentMarkers.map(m => m.getLatLng()));
            map.fitBounds(bounds.pad(0.1));
        } else {
            map.setView([4.5709, -74.2973], 6);
        }
    });
}

// ===== FUNCIONES UTILITARIAS =====
function updateStatus(message, type = 'info') {
    const badge = document.getElementById('data-status-badge');
    if (!badge) return;

    const icons = {
        'info': 'fa-sync fa-spin',
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle'
    };

    const colors = {
        'info': 'bg-primary',
        'success': 'bg-success',
        'error': 'bg-danger',
        'warning': 'bg-warning'
    };

    badge.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i> ${message}`;
    badge.className = `badge ${colors[type] || 'bg-info'}`;
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const badge = document.getElementById('last-update-badge');
    if (badge) {
        badge.innerHTML = `<i class="fas fa-clock"></i> ${timeString}`;
    }
}

function showErrorMessage(message) {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr id="error-row">
            <td colspan="8" class="text-center py-5">
                <i class="fas fa-database fa-3x text-danger mb-3"></i>
                <h5 class="text-danger">Error cargando datos</h5>
                <p>${message}</p>
                <button onclick="loadDataFromSupabase()" class="btn btn-primary mt-3">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </td>
        </tr>
    `;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = `
        top: 20px; right: 20px; z-index: 9999; min-width: 300px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2); border-radius: 10px;
        animation: slideIn 0.3s ease;
    `;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

    notification.innerHTML = `
        <strong>${icons[type] || ''} ${type === 'success' ? 'Éxito' : type.charAt(0).toUpperCase() + type.slice(1)}</strong>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// ===== EXPORTAR FUNCIONES GLOBALES =====
window.loadDataFromSupabase = loadDataFromSupabase;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.exportData = exportData;