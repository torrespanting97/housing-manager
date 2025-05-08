let map;
let vectorLayer;
let errorLayer;
let geocoder;
let lastSearchQuery = '';
let searchMarkerLayer;

// Initialize main map view
function initMap(properties) {
    try {
        // Create map instance
        map = new ol.Map({
            target: 'map',
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.OSM()
                })
            ],
            view: new ol.View({
                center: ol.proj.fromLonLat([-98.5795, 39.8283]),
                zoom: 4
            })
        });

        // Add map controls
        map.addControl(new ol.control.Zoom());
        map.addControl(new ol.control.FullScreen());

        // Initialize layers
        initErrorLayer();
        initSearchMarkerLayer();

        // Add property markers
        if (properties && properties.length > 0) {
            addPropertyMarkers(properties);
        }

        // Setup search functionality
        setupSearch();

    } catch (error) {
        console.error('Map initialization error:', error);
        showError('Map initialization failed');
    }
}

function initErrorLayer() {
    errorLayer = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: new ol.style.Style({
            image: new ol.style.Icon({
                src: 'https://cdn-icons-png.flaticon.com/512/753/753345.png',
                scale: 0.5
            })
        }),
        zIndex: 1000
    });
    map.addLayer(errorLayer);
}

function initSearchMarkerLayer() {
    searchMarkerLayer = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: new ol.style.Style({
            image: new ol.style.Icon({
                src: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scale: 1
            })
        }),
        zIndex: 999
    });
    map.addLayer(searchMarkerLayer);
}

function setupSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('address-search');
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleSearch();
        });
    }
}

// Update the handleSearch function to better handle coordinate input
function handleSearch() {
    const query = document.getElementById('address-search').value.trim();
    if (!query) {
        showSearchError('Please enter an address or coordinates (lat, lon)');
        return;
    }

    lastSearchQuery = query;
    searchAddress(query);
}

function searchAddress(query) {
    showLoadingIndicator();
    
    // Clear previous search results
    searchMarkerLayer.getSource().clear();
    
    // First try to parse as coordinates (lat, lon or lat lon format)
    const coordMatch = query.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        searchByCoordinates(lat, lon);
        return;
    }
    
    // If not coordinates, try Nominatim geocoding
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
        signal: controller.signal
    })
    .then(response => {
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
    })
    .then(results => {
        if (!results || results.length === 0) {
            // If address search fails, check if query might be coordinates
            const coordParts = query.split(/[,\s]+/).filter(part => part !== '');
            if (coordParts.length === 2) {
                const lat = parseFloat(coordParts[0]);
                const lon = parseFloat(coordParts[1]);
                if (!isNaN(lat) && !isNaN(lon)) {
                    searchByCoordinates(lat, lon);
                    return;
                }
            }
            throw new Error('No results found for this search');
        }
        
        const result = results[0];
        const coord = ol.proj.fromLonLat([parseFloat(result.lon), parseFloat(result.lat)]);
        
        // Add search result marker
        const marker = new ol.Feature({
            geometry: new ol.geom.Point(coord),
            name: 'Search Result',
            address: result.display_name
        });
        
        searchMarkerLayer.getSource().addFeature(marker);
        
        // Zoom to result
        map.getView().animate({
            center: coord,
            zoom: 15
        });
    })
    .catch(error => {
        clearTimeout(timeout);
        const errorMsg = error.name === 'AbortError' ? 'Search timed out' : error.message;
        showSearchError(`Search failed: ${errorMsg}`);
    })
    .finally(() => {
        hideLoadingIndicator();
    });
}

function addPropertyMarkers(properties) {
    // Remove existing layer if it exists
    if (vectorLayer) {
        map.removeLayer(vectorLayer);
    }

    const features = [];
    let hasValidProperties = false;

    properties.forEach(property => {
        // Skip properties without coordinates
        if (!property.latitude || !property.longitude) {
            console.warn(`Property ${property.id} missing coordinates`);
            return;
        }

        const feature = new ol.Feature({
            geometry: new ol.geom.Point(
                ol.proj.fromLonLat([parseFloat(property.longitude), parseFloat(property.latitude)])
            ),
            property: property
        });

        // Customize marker style based on property status
        let iconColor = 'blue';
        if (property.status === 'Sold') iconColor = 'red';
        if (property.status === 'Pending') iconColor = 'orange';

        feature.setStyle(new ol.style.Style({
            image: new ol.style.Icon({
                src: `https://maps.google.com/mapfiles/ms/icons/${iconColor}-dot.png`,
                scale: 0.8
            })
        }));

        features.push(feature);
        hasValidProperties = true;
    });

    if (!hasValidProperties) {
        showSearchError('No properties with valid coordinates found');
        return;
    }

    // Create vector layer with all features
    vectorLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: features
        })
    });

    map.addLayer(vectorLayer);

    // Adjust view based on number of properties
    if (hasValidProperties) {
        if (features.length === 1) {
            // For single property, zoom to street level
            const property = features[0].get('property');
            map.getView().animate({
                center: ol.proj.fromLonLat([property.longitude, property.latitude]),
                zoom: 15,
                duration: 1000
            });
        } else {
            // For multiple properties, calculate optimal zoom
            const extent = vectorLayer.getSource().getExtent();
            const size = ol.extent.getWidth(extent);

            // After getting the extent
            if (!ol.extent.isEmpty(extent)) {
                // Proceed with zoom calculation
            } else {
                // Fallback to default zoom
                map.getView().setZoom(10);
            }
            
            // Dynamic zoom calculation based on area covered
            let targetZoom;
            if (size > 10) { // Very spread out (country level)
                targetZoom = 11.5;
            } else if (size > 5) { // State level
                targetZoom = 13.5;
            } else if (size > 1) { // City level
                targetZoom = 14;
            } else if (size > 0.1) { // Neighborhood level
                targetZoom = 15;
            } else { // Very close together
                // Add this inside the else block for multiple properties
                if (features.length > 20 && size < 0.5) {
                    // High density of markers in small area
                    targetZoom = Math.max(targetZoom, 13);
                    padding = Math.min(70, 30 + (features.length * 1));
                }
            }

            // Apply padding based on number of markers
            const padding = Math.min(100, 50 + (features.length * 2));
            
            map.getView().fit(extent, {
                padding: [padding, padding, padding, padding],
                maxZoom: targetZoom,
                duration: 1000
            });
        }
    }

    // Setup interactions
    setupMapInteractions();
}

function setupMapInteractions() {
    // Click event for property details
    map.on('click', function(evt) {
        const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
            return feature;
        });

        if (feature && feature.get('property')) {
            window.location.href = `/property/${feature.get('property').id}`;
        }
    });

    // Pointer movement
    map.on('pointermove', function(e) {
        const hit = map.hasFeatureAtPixel(e.pixel);
        map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });
}

function showLoadingIndicator() {
    const loader = document.createElement('div');
    loader.className = 'map-loading';
    loader.innerHTML = '<div class="spinner"></div>Searching...';
    document.querySelector('.search-container').appendChild(loader);
}

function hideLoadingIndicator() {
    const loader = document.querySelector('.map-loading');
    if (loader) loader.remove();
}

function showSearchError(message) {
    if (!errorLayer || !errorLayer.getSource()) {
        showError(message);
        return;
    }

    errorLayer.getSource().clear();
    const errorFeature = new ol.Feature({
        geometry: new ol.geom.Point(map.getView().getCenter())
    });
    errorLayer.getSource().addFeature(errorFeature);

    const errorElement = document.createElement('div');
    errorElement.className = 'map-error-message';
    errorElement.textContent = message;
    
    const existingError = document.querySelector('.map-error-message');
    if (existingError) existingError.remove();
    
    document.getElementById('map').appendChild(errorElement);
    setTimeout(() => errorElement.classList.add('visible'), 100);

    setTimeout(() => {
        errorElement.classList.remove('visible');
        setTimeout(() => errorElement.remove(), 500);
        errorLayer.getSource().clear();
    }, 5000);
}

function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'map-error-message';
    errorElement.textContent = message;
    
    const existingError = document.querySelector('.map-error-message');
    if (existingError) existingError.remove();
    
    document.body.appendChild(errorElement);
    setTimeout(() => errorElement.classList.add('visible'), 100);

    setTimeout(() => {
        errorElement.classList.remove('visible');
        setTimeout(() => errorElement.remove(), 500);
    }, 5000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('map')) {
        try {
            const mapDataElement = document.getElementById('map-data');
            if (!mapDataElement) throw new Error('Map data element not found');
            
            const propertiesData = mapDataElement.textContent;
            if (!propertiesData) throw new Error('No properties data found');
            
            const properties = JSON.parse(propertiesData);
            if (!Array.isArray(properties)) throw new Error('Invalid property data structure');
            
            initMap(properties);
        } catch (error) {
            console.error('Initialization error:', error);
            showError(error.message);
        }
    }
});

// Add this new function to handle coordinate search
function searchByCoordinates(lat, lon) {
    showLoadingIndicator();
    
    try {
        // Validate coordinates
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            throw new Error('Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180');
        }

        const coord = ol.proj.fromLonLat([parseFloat(lon), parseFloat(lat)]);
        
        // Add search result marker
        const marker = new ol.Feature({
            geometry: new ol.geom.Point(coord),
            name: 'Coordinate Search Result',
            address: `Lat: ${lat}, Lon: ${lon}`
        });
        
        searchMarkerLayer.getSource().clear();
        searchMarkerLayer.getSource().addFeature(marker);
        
        // Zoom to result
        map.getView().animate({
            center: coord,
            zoom: 15
        });
        
    } catch (error) {
        showSearchError(error.message);
    } finally {
        hideLoadingIndicator();
    }
}