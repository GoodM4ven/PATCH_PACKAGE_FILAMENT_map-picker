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
            isUserInteracting: false,
programmaticMove: false,
geocodeAbort: null,
            
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

                this.map = LF.map(el, this.config.controls);

                if (this.config.bounds) {
                    const sw = LF.latLng(this.config.bounds.sw.lat, this.config.bounds.sw.lng);
                    const ne = LF.latLng(this.config.bounds.ne.lat, this.config.bounds.ne.lng);
                    const bounds = LF.latLngBounds(sw, ne);
                    this.map.setMaxBounds(bounds);
                    this.map.fitBounds(bounds);
                    this.map.on('drag', () => this.map.panInsideBounds(bounds, { animate: false }));
                }

                this.map.on('load', () => setTimeout(() => this.map.invalidateSize(true), 0));

                if (!this.config.draggable) this.map.dragging.disable();

                if (this.config.clickable) {
                    this.map.on('click', (e) => this.setCoordinates(e.latlng));
                }

                this.tile = LF.tileLayer(this.config.tilesUrl, {
                    attribution: this.config.attribution,
                    minZoom: this.config.minZoom,
                    maxZoom: this.config.maxZoom,
                    tileSize: this.config.tileSize,
                    zoomOffset: this.config.zoomOffset,
                    detectRetina: this.config.detectRetina,
                }).addTo(this.map);

                if (this.config.searchable) this.addSearchControl();

                if (this.config.showMarker) {
                    this.marker = LF.marker(this.getCoordinates(), {
                    icon: this.createMarkerIcon(),
                    draggable: false,
                    autoPan: false,
                    }).addTo(this.map);
                    this.setMarkerRange();
                }

                // Track user vs programmatic moves
                this.map.on('movestart', () => { this.isUserInteracting = !this.programmaticMove; });
                this.map.on('moveend', () => {
                    if (!this.config.clickable && this.isUserInteracting) {
                    this.setCoordinates(this.map.getCenter());
                    this.setMarkerRange();
                    }
                    this.isUserInteracting = false;
                    this.programmaticMove = false;
                    this.setFormRestorationState(false, this.map.getZoom());
                });

                // Initial view
                const location = this.getCoordinates();
                if (!location.lat && !location.lng) {
                    if (this.config.askForCurrentLocation) {
                    this.programmaticMove = true;
                    this.map.locate({
                        setView: true,
                        maxZoom: this.config.controls.maxZoom,
                        enableHighAccuracy: true,
                        watch: false
                    });
                    } else {
                    this.programmaticMove = true;
                    this.map.setView(new LF.LatLng(this.config.default.lat, this.config.default.lng), this.config.controls.zoom);
                    }
                } else {
                    this.programmaticMove = true;
                    this.map.setView(new LF.LatLng(location.lat, location.lng), this.config.controls.zoom);
                }

                this.map.on('locationfound', () => {
                    this.programmaticMove = true;
                    this.map.setZoom(this.config.controls.zoom);
                });

                if (this.config.showMyLocationButton) this.addLocationButton();

                if (this.config.liveLocation.send && this.config.liveLocation.realtime) {
                    setInterval(() => this.fetchCurrentLocation(), this.config.liveLocation.miliseconds);
                }
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
                if (this.marker && this.config.showMarker) this.marker.setLatLng(coords);
                this.setFormRestorationState(coords);

                if (!this.debouncedUpdate) {
                    this.debouncedUpdate = this.debounce((c) => {
                    if (this.config.type === 'field') {
                        this.$wire.set(this.config.statePath, {
                        ...this.$wire.get(this.config.statePath),
                        lat: c.lat, lng: c.lng
                        });
                    }
                    if (this.config.liveLocation.send) this.$wire.$refresh();
                    this.updateMarker();
                    if (this.config.searchable) this.reverseGeocode(c);
                    }, this.config.updateDelay || 500);
                }
                this.debouncedUpdate(coords);
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
                if (!('geolocation' in navigator)) {
                    alert('Geolocation is not supported by this browser.');
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                    const p = new LF.LatLng(pos.coords.latitude, pos.coords.longitude);
                    this.programmaticMove = true;
                    this.map.setView(p, this.config.controls.zoom, { animate: true });
                    this.setCoordinates(p);
                    this.updateMarker();
                    },
                    (err) => console.error('Error fetching current location:', err),
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            },

            searchAddress: function (query) {
                const key = this.config.maptilerKey;
                if (!this.config.searchable || !query || !key) return;

                if (this.geocodeAbort) this.geocodeAbort.abort();
                this.geocodeAbort = new AbortController();

                const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${encodeURIComponent(key)}&limit=1`;

                fetch(url, { signal: this.geocodeAbort.signal })
                    .then(r => r.ok ? r.json() : Promise.reject(r))
                    .then(json => {
                    const f = json && Array.isArray(json.features) ? json.features[0] : null;
                    if (!f || !f.geometry || !Array.isArray(f.geometry.coordinates)) return;
                    const [lng, lat] = f.geometry.coordinates;
                    const coords = { lat, lng };
                    this.programmaticMove = true;
                    this.map.setView(new LF.LatLng(lat, lng), Math.max(14, this.map.getZoom() || 14), { animate: true });
                    this.setCoordinates(coords);
                    this.updateMarker();
                    })
                    .catch(err => {
                    if (err.name !== 'AbortError') console.error('Geocoding error:', err);
                    });
            },

            reverseGeocode: function (coords) {
                const key = this.config.maptilerKey;
                if (!this.config.searchable || !key || !coords) return;

                const url = `https://api.maptiler.com/geocoding/${coords.lng},${coords.lat}.json?key=${encodeURIComponent(key)}&limit=1`;

                fetch(url)
                    .then(r => r.ok ? r.json() : Promise.reject(r))
                    .then(json => {
                    const f = json && Array.isArray(json.features) ? json.features[0] : null;
                    const label = f && (f.place_name || f.text || (f.properties && f.properties.name));
                    if (label && this.searchInput) this.searchInput.value = label;
                    })
                    .catch(err => console.error('Reverse geocoding error:', err));
            },

            addSearchControl: function () {
                const that = this;
                const SearchCtl = LF.Control.extend({
                    options: { position: 'topleft' },
                    onAdd: function () {
                    const container = LF.DomUtil.create('div', 'leaflet-bar leaflet-control');
                    const input = LF.DomUtil.create('input', 'map-search-input', container);
                    input.type = 'search';
                    input.placeholder = that.config.searchPlaceholder || 'Search address...';
                    input.autocomplete = 'off';
                    input.spellcheck = false;

                    const doSearch = that.debounce(() => that.searchAddress(input.value), 450);

                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') { e.preventDefault(); that.searchAddress(input.value); }
                    });
                    input.addEventListener('input', () => doSearch());

                    // prevent map interactions while typing
                    LF.DomEvent.disableClickPropagation(container);
                    LF.DomEvent.disableScrollPropagation(container);
                    that.searchInput = input;
                    return container;
                    }
                });
                this.map.addControl(new SearchCtl());
            },

            addLocationButton: function () {
                const that = this;
                const MyLoc = LF.Control.extend({
                    options: { position: 'topleft' },
                    onAdd: function () {
                    const container = LF.DomUtil.create('div', 'leaflet-bar');
                    const btn = LF.DomUtil.create('a', 'leaflet-control-zoom-in', container);
                    btn.href = '#';
                    btn.title = 'Go to my location';
                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a1 1 0 0 1 1 1v1a8 8 0 0 1 7 7h1a1 1 0 1 1 0 2h-1a8 8 0 0 1-7 7v1a1 1 0 1 1-2 0v-1a8 8 0 0 1-7-7H2a1 1 0 1 1 0-2h1a8 8 0 0 1 7-7V3a1 1 0 0 1 1-1Zm0 5a5 5 0 1 0 .001 10.001A5 5 0 0 0 12 7Z"/></svg>';
                    LF.DomEvent.on(btn, 'click', (e) => {
                        LF.DomEvent.preventDefault(e);
                        LF.DomEvent.stopPropagation(e);
                        that.fetchCurrentLocation();
                    });
                    LF.DomEvent.disableClickPropagation(container);
                    LF.DomEvent.disableScrollPropagation(container);
                    return container;
                    }
                });
                this.map.addControl(new MyLoc());
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

            updateMarker: function () {
                if (this.config.showMarker && this.marker) {
                    this.marker.setLatLng(this.getCoordinates());
                    this.setMarkerRange();
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
