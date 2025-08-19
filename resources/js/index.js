import * as LF from 'leaflet';
import 'leaflet-fullscreen';

document.addEventListener('DOMContentLoaded', () => {
    const mapPicker = ($wire, config, state) => {
        return {
            map: null,
            tile: null,
            marker: null,
            rangeCircle: null,
            rangeSelectField: null,
            formRestorationHiddenInput:null,
            debouncedUpdate: null,
            searchInput: null,
            
            debounce: function(func, wait) {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            },
            
            createMap: function (el) {
                const that = this;

                this.map = LF.map(el, config.controls);

                if(config.bounds)
                {
                    let southWest = LF.latLng(config.bounds.sw.lat, config.bounds.sw.lng);
                    let northEast = LF.latLng(config.bounds.ne.lat, config.bounds.ne.lng);
                    let bounds = LF.latLngBounds(southWest, northEast);
                    this.map.setMaxBounds(bounds);
                    this.map.fitBounds(bounds);
                    this.map.on('drag', function() {
                        that.map.panInsideBounds(bounds, { animate: false });
                    });
                }
                this.map.on('load', () => {
                    setTimeout(() => this.map.invalidateSize(true), 0);
                    
                    if (config.showMarker && !config.clickable) {
                        this.marker.setLatLng(this.map.getCenter());
                    }
                });

                if (!config.draggable) {
                    this.map.dragging.disable();
                }

                if(config.clickable)
                {
                    this.map.on('click', function(e) {
                        that.setCoordinates(e.latlng);
                    });
                }

                this.tile = LF.tileLayer(config.tilesUrl, {
                    attribution: config.attribution,
                    minZoom: config.minZoom,
                    maxZoom: config.maxZoom,
                    tileSize: config.tileSize,
                    zoomOffset: config.zoomOffset,
                    detectRetina: config.detectRetina,
                }).addTo(this.map);

                if (config.searchable) {
                    this.addSearchControl();
                }

                if (config.showMarker) {
                    this.marker = LF.marker(this.getCoordinates(), {
                        icon: this.createMarkerIcon(),
                        draggable: false,
                        autoPan: true
                    }).addTo(this.map);
                    this.setMarkerRange();
                    if(!config.clickable) {
                        this.map.on('move', () => this.setCoordinates(this.map.getCenter()));
                    }
                }

                if(!config.clickable)
                {
                    this.map.on('moveend', () => this.updateLocation());
                }

                this.map.on('locationfound', function () {
                    that.map.setZoom(config.controls.zoom);
                });

                let location = this.getCoordinates();
                if (!location.lat && !location.lng) {
                    if (config.askForCurrentLocation) {
                        this.map.locate({
                            setView: true,
                            maxZoom: config.controls.maxZoom,
                            enableHighAccuracy: true,
                            watch: false
                        });
                    } else {
                        this.map.setView(new LF.LatLng(config.default.lat, config.default.lng));
                    }
                } else {
                    this.map.setView(new LF.LatLng(location.lat, location.lng));
                }

                if (config.showMyLocationButton) {
                    this.addLocationButton();
                }

                if (config.liveLocation.send && config.liveLocation.realtime) {
                    setInterval(() => {
                        this.fetchCurrentLocation();
                    }, config.liveLocation.miliseconds);
                }
                this.map.on('zoomend',function(event) {
                    that.setFormRestorationState(false, that.map.getZoom());
                });

            },
            createMarkerIcon() {
                if (config.markerIconUrl) {
                    return LF.icon({
                        iconUrl: config.markerIconUrl,
                        iconSize: config.markerIconSize,
                        iconAnchor: config.markerIconAnchor,
                        className: config.markerIconClassName
                    });
                }

                const markerColor = config.markerColor || "#3b82f6";
                const defaultHtml = `<svg xmlns="http://www.w3.org/2000/svg" class="map-icon" fill="${markerColor}" width="36" height="36" viewBox="0 0 24 24"><path d="M12 0c-4.198 0-8 3.403-8 7.602 0 4.198 3.469 9.21 8 16.398 4.531-7.188 8-12.2 8-16.398 0-4.199-3.801-7.602-8-7.602zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z"/></svg>`;
                
                return LF.divIcon({
                    html: config.markerHtml || defaultHtml,
                    className: config.markerIconClassName,
                    iconSize: config.markerIconSize,
                    iconAnchor: config.markerIconAnchor
                });
            },
            initFormRestoration: function () {
                this.formRestorationHiddenInput = document.getElementById(config.statePath+'_fmrest');
                window.addEventListener("pageshow", (event) => {

                    let restoredState = this.getFormRestorationState();
                    if(restoredState){
                        let coords = new LF.LatLng(restoredState.lat, restoredState.lng);
                        config.zoom = restoredState.zoom;
                        config.controls.zoom=restoredState.zoom;
                        this.setCoordinates(coords);
                    }
                });
            },
            setFormRestorationState: function(coords = null, zoom = null) {
                coords = coords || this.getFormRestorationState() || this.getCoordinates();
            
                if (this.map) {
                    coords.zoom = zoom ?? this.map.getZoom();
                }
            
                this.formRestorationHiddenInput.value = JSON.stringify(coords);
            },
            getFormRestorationState: function () {
                if(this.formRestorationHiddenInput.value)
                    return JSON.parse(this.formRestorationHiddenInput.value);
                return false;
            },
            updateLocation: function() {
                let oldCoordinates = this.getCoordinates();
                let currentCoordinates = this.map.getCenter();
                if(config.clickable) {
                    currentCoordinates = this.marker.getLatLng();
                }

                const minChange = config.minChange || 0.00001; 
                if (Math.abs(oldCoordinates.lng - currentCoordinates.lng) > minChange || 
                    Math.abs(oldCoordinates.lat - currentCoordinates.lat) > minChange) {
                    this.setCoordinates(currentCoordinates);
                    this.setMarkerRange();
                }
            },

            removeMap: function (el) {
                if (this.marker) {
                    this.marker.remove();
                    this.marker = null;
                }
                this.tile.remove();
                this.tile = null;
                this.map.off();
                this.map.remove();
                this.map = null;
            },

            getCoordinates: function () {
                if(state){
                    return state;
                }
                
                let location = $wire.get(config.statePath)  ?? {};

                const hasValidCoordinates = location.hasOwnProperty('lat') && location.hasOwnProperty('lng') &&
                    location.lat !== null && location.lng !== null;

                if (!hasValidCoordinates) {
                    location = {
                        lat: config.default.lat,
                        lng: config.default.lng
                    };
                }

                return location;
            },

            setCoordinates: function (coords) {
                if (this.marker && config.showMarker) {
                    this.marker.setLatLng(coords);
                }
                this.setFormRestorationState(coords);

                if (!this.debouncedUpdate) {
                    this.debouncedUpdate = this.debounce((coords) => {
                        if(config.type === 'field'){
                            $wire.set(config.statePath, {
                                ...$wire.get(config.statePath),
                                lat: coords.lat,
                                    lng: coords.lng
                                });
                        }

                        if (config.liveLocation.send) {
                            $wire.$refresh();
                        }
                        this.updateMarker();
                    }, config.updateDelay || 500);
                }

                this.debouncedUpdate(coords);

                if (config.searchable) {
                    this.reverseGeocode(coords);
                }

                return coords;
            },

            attach: function (el) {
                this.createMap(el);
                const observer = new IntersectionObserver(entries => {
                    entries.forEach(entry => {
                        if (entry.intersectionRatio > 0) {
                            if (!this.map)
                                this.createMap(el);
                        } else {
                            this.removeMap(el);
                        }
                    });
                }, {
                    root: null,
                    rootMargin: '0px',
                    threshold: 1.0
                });
                observer.observe(el);
            },

            fetchCurrentLocation: function () {
                if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(async position => {
                        const currentPosition = new LF.LatLng(position.coords.latitude, position.coords.longitude);
                        await this.map.flyTo(currentPosition);

                        this.updateLocation();
                        this.updateMarker();
                    }, error => {
                        console.error('Error fetching current location:', error);
                    });
                } else {
                    alert('Geolocation is not supported by this browser.');
                }
            },

            searchAddress: function(query) {
                if (!query) {
                    return;
                }

                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
                    .then(response => response.json())
                    .then(result => {
                        if (Array.isArray(result) && result.length > 0) {
                            const lat = parseFloat(result[0].lat);
                            const lng = parseFloat(result[0].lon);
                            const coords = { lat: lat, lng: lng };
                            this.map.setView(new LF.LatLng(lat, lng));
                            this.setCoordinates(coords);
                            this.updateMarker();
                        }
                    })
                    .catch(error => console.error('Geocoding error:', error));
            },

            reverseGeocode: function(coords) {
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`)
                    .then(response => response.json())
                    .then(result => {
                        if (result && result.display_name && this.searchInput) {
                            this.searchInput.value = result.display_name;
                        }
                    })
                    .catch(error => console.error('Reverse geocoding error:', error));
            },

            addSearchControl: function() {
                const searchControl = LF.control({ position: 'topleft' });
                searchControl.onAdd = () => {
                    const container = LF.DomUtil.create('div', 'leaflet-bar leaflet-control');
                    const button = LF.DomUtil.create('a', '', container);
                    button.href = '#';
                    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path stroke="currentColor" stroke-width="2" fill="none" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>';

                    this.searchInput = LF.DomUtil.create('input', 'map-search-input', container);
                    this.searchInput.type = 'text';
                    this.searchInput.placeholder = config.searchPlaceholder || 'Search address...';
                    this.searchInput.style.display = 'none';

                    LF.DomEvent.on(button, 'click', (e) => {
                        LF.DomEvent.preventDefault(e);
                        LF.DomEvent.stopPropagation(e);
                        if (this.searchInput.style.display === 'none') {
                            this.searchInput.style.display = 'block';
                            this.searchInput.focus();
                        } else {
                            this.searchInput.style.display = 'none';
                        }
                    });

                    this.searchInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this.searchAddress(this.searchInput.value);
                            this.searchInput.style.display = 'none';
                        }
                    });

                    LF.DomEvent.disableClickPropagation(container);
                    LF.DomEvent.disableScrollPropagation(container);

                    return container;
                };

                searchControl.addTo(this.map);
            },

            addLocationButton: function() {
                const locationButton = document.createElement('button');
                locationButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 0C8.25 0 5 3.25 5 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.75-3.25-7-7-7zm0 10c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-5c-1.11 0-2 .89-2 2s.89 2 2 2 2-.89 2-2-.89-2-2-2z"/></svg>';
                locationButton.type = 'button';
                locationButton.classList.add('map-location-button');
                locationButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.fetchCurrentLocation();
                });
                LF.DomEvent.disableClickPropagation(locationButton);
                LF.DomEvent.disableScrollPropagation(locationButton);
                this.map.getContainer().appendChild(locationButton);
            },

            setMarkerRange: function() {
                if ((config.clickable && !this.marker) || !this.rangeSelectField) {
                    return;
                }
            
                const distance = parseInt(this.rangeSelectField.value || 0);
                const coordinates = this.getCoordinates();
                const circleStyle = {
                    color: 'blue',
                    fillColor: '#f03',
                    fillOpacity: 0.5,
                    radius: distance
                };
                
                if (this.rangeCircle) {
                    this.rangeCircle
                        .setLatLng(coordinates)
                        .setRadius(distance);
                    return;
                }
                
                this.rangeCircle = LF.circle(coordinates, circleStyle).addTo(this.map);
            },

            init: function() {
                this.$wire = $wire;
                this.config = config;
                this.state = state;
                
                this.rangeSelectField = document.getElementById(config.rangeSelectField);
                this.initFormRestoration();

                let that=this
                if(this.rangeSelectField){
                    this.rangeSelectField.addEventListener('change', function () {that.updateMarker(); });
                }
                $wire.on('refreshMap', this.refreshMap.bind(this));
            },

            updateMarker: function() {
                if (config.showMarker && this.marker) {
                    this.marker.setLatLng(this.getCoordinates());
                    this.setMarkerRange();
                    this.updateLocation();
                }
            },

            refreshMap: function() {
                this.map.flyTo(this.getCoordinates());
                this.updateMarker();
            }
        };
    };

    window.mapPicker = mapPicker;

    window.dispatchEvent(new CustomEvent('map-script-loaded'));
});
