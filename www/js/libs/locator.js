define(["jquery", "gmaps"], function ($, google) {
    var Locator = {
        map: null,
        mapSelector: null,
        geocoder: null,
        markers: [],
        bestFitBounds: null,
        settings: {
            lastCenter: null,
            lastZoom: null,
            startCentre: [-28, 135],
            startZoom: 4,
            resultLimit: 20,
            apiVersion: '3',
            apiIsLoaded: false
        },
        filterAddresses: function (results, region) {
            //NT: special filtering rules applied to colloquial_area
            var allowedAddressTypes = [
                'street_number',
                'street_address',
                'route',
                'intersection',
                'political',
                'country',
                'administrative_area_level_1',
                'administrative_area_level_2',
                'administrative_area_level_3',
                'locality',
                'sublocality',
                'neighborhood',
                'premise',
                'subpremise',
                'postal_code',
                'colloquial_area'
            ];
            var filtered_values = [];
            if (results != null) {

                //NT: if there is > 1 result then filter out colloquial_area (workaround suggested by Google)
                if (results.length > 1) {
                    var newResults = [];
                    for (var i = 0; i < results.length; i++) {
                        if ($.inArray('colloquial_area', results[i].types) == -1) {
                            newResults.push(results[i]);
                        }
                    }
                    results = newResults;
                }

                for (var i = 0; i < results.length; i++) {
                    var result = results[i];
                    var numComponents = result.address_components.length;
                    var types = result.types;
                    var found = false;
                    var addressAllowed = true;

                    //check if this is an allowed address
                    for (var l = 0; l < types.length; l++) {
                        if ($.inArray(types[l], allowedAddressTypes) == -1) {
                            addressAllowed = false;
                        }
                    }

                    if (addressAllowed) {
                        for (var j = 0; j < numComponents && !found; j++) {
                            var component = result.address_components[j];
                            var types = component.types;
                            for (var k = 0; k < types.length && !found; k++) {
                                if (types[k] == 'country') {
                                    if (component.long_name == region) {
                                        filtered_values.push(results[i]);
                                        found = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    //reset
                    addressAllowed = true;

                }
            }
            return filtered_values;
        },
        geocodeSuccess: function (results) { },
        geocodeFail: function () { },
        geocode: function (address) {
            var _SELF = this;
            if (!this.geocoder) { this.geocoder = new google.maps.Geocoder(); }
            var request = {
                address: address.replace("%25", ""),
                region: "AU"
            };
            this.geocoder.geocode(request, function (results, status) {
                if (status == 'OK' && results.length >= 1) {
                    results = _SELF.filterAddresses(results, 'Australia');
                    Locator.geocodeSuccess(results);
                }
                else {
                    //error: no results returned from geocoder
                    Locator.geocodeFail();
                }
            });
        },
        getWindowDimensions: function () {
            var myWidth = 0, myHeight = 0;
            if (typeof (window.innerWidth) == 'number') {
                //Non-IE
                myWidth = window.innerWidth;
                myHeight = window.innerHeight;
            } else if (document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
                //IE 6+ in 'standards compliant mode'
                myWidth = document.documentElement.clientWidth;
                myHeight = document.documentElement.clientHeight;
            } else if (document.body && (document.body.clientWidth || document.body.clientHeight)) {
                //IE 4 compatible
                myWidth = document.body.clientWidth;
                myHeight = document.body.clientHeight;
            }
            return {
                height: myHeight,
                width: myWidth
            };
        },
        mapResize: function () {             
            if (Locator.map != null) {
                google.maps.event.trigger(Locator.map, "resize");
            }
        },
        windowResize: function (selector) {
            var _SELF = this;
            var windowDimensions = _SELF.getWindowDimensions();
            var height = windowDimensions.height;
            var width = windowDimensions.width;
            if (height < 369) {
                height = 369;
            }
            $('#' + selector).height(height - 240);
            if (Locator.map != null) {
                google.maps.event.trigger(Locator.map, "resize");
            }
        },
        setBestView: function () {
            var _SELF = this;
            if (_SELF.map) {
                _SELF.mapResize();
                if (_SELF.bestFitBounds || (_SELF.markers && _SELF.markers.length > 0)) {
                    _SELF.bestFitBounds = _SELF.bestFitBounds || new google.maps.LatLngBounds();
                    $.each(_SELF.markers, function () {
                        _SELF.bestFitBounds.extend(this.getPosition());
                    });
                    _SELF.map.fitBounds(_SELF.bestFitBounds);
                }
                else if (_SELF.center) {
                    _SELF.map.setCenter(_SELF.center);
                }
            }        
            return this;
        },
        centerMap: function (latitude, longitude) {
            var _SELF = this;                     
            if (_SELF.map) {
                _SELF.center = new google.maps.LatLng(latitude, longitude);
                _SELF.map.setCenter(_SELF.center);
                _SELF.map.setZoom(10);
            }
            return this;
        },
        addMarker: function (poi) {
            var _SELF = this;
            var point = new google.maps.LatLng(poi.location.lat, poi.location.lng);
            var settings = {
                position: point,
                map: _SELF.map,
                title: poi.title
            };
            var marker = new google.maps.Marker(settings);
            _SELF.markers.push(marker);
            return marker;
        },
        resetMarkers: function () {
            var _SELF = this;
            if (_SELF.markers && _SELF.markers.length) {
                $.each(_SELF.markers, function () {
                    this.setMap(null);
                });
                _SELF.markers = [];
                _SELF.bestFitBounds = null;
            }
            return this;
        },
        initMap: function (selector, domElement) {
            var _SELF = this;
            _SELF.mapSelector = selector;
            _SELF.windowResize(Locator.mapSelector);
            this.map = new google.maps.Map(domElement || document.getElementById(selector), {
                center: new google.maps.LatLng(_SELF.settings.startCentre[0], _SELF.settings.startCentre[1]),
                zoom: Locator.settings.startZoom,
                streetViewControl: false,
                panControl: false,
                minZoom: Locator.settings.startZoom,
                mapTypeControlOptions: {
                    style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                    mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.HYBRID, google.maps.MapTypeId.SATELLITE]
                },
                zoomControlOptions: {
                    style: google.maps.ZoomControlStyle.SMALL
                },
                mapTypeId: google.maps.MapTypeId.ROADMAP
            });
            $(window).resize(function () {
                _SELF.windowResize(Locator.mapSelector);
            });
        },
        init: function (options) {
            var _SELF = this;
            if (options != null) {
                $.extend(this, options);
            }
            this.initAPI();
        }
    }

    return Locator;

});