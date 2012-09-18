// filename: models.js
define([
    'jquery',
    'app',
    'backbone',
    'locator'
], function ($, app, Backbone, locator) {

    var models = {};

    // field
    models.field = {

        fetch: false,

        idAttribute: 'field_id',

        collections: {

            fields: {

                resource: '/fields'
            }
        }
    }

    // taxonomy term
    models.term = {

        resource: '/taxonomy_term',

        idAttribute: 'tid',

        collections: {

            terms: {

                resource: '/taxonomy_term'
            }
        },
        
        views: {
            
            term: {
                
                className: 'taxonomy-term',
                
                template: 'term'
            }
        }
    };

    // taxonomy vocabulary
    models.vocab = {

        resource: '/taxonomy_vocabulary',

        idAttribute: 'vid',

        collections: {

            vocabs: {

                resource: '/taxonomy_vocabulary'
            }
        }
    };

    // user
    models.user = {

        resource: '/user',

        idAttribute: 'uid',

        collections: {

            users: {

                resource: '/user'
            }
        },
        
        // override sync method to use session
        sync: function(method, model, options) {
            var deferred = $.Deferred(), args = arguments;
            if (method === 'read') {
                model.destination = model.id;
                model.id = null;
                app.session.isAuthenticated(function (loggedIn) {
                    if (loggedIn && app.session.getUser()) {
                        if (!app.session.getUser().get('fetched')) {  // full model needs to be fetched
                            model.id = app.session.getUserId();
                            Backbone.sync.apply(model, args).done(function () {
                                model.set('fetched', true, {silent: true}); // set fetched flag
                                app.session.setUser(model);
                                deferred.resolve(model);
                            }).fail(deferred.reject);
                        }
                        else { // full model has already been fetched
                            if (!model.set(model.parse(app.session.getUser().attributes), options)) {
                                deferred.reject();
                                return false;
                            }
                            if (options.success) options.success(model);
                            deferred.resolve(model);
                        }
                    }
                    else {
                        deferred.resolve();
                    }
                }).fail(deferred.reject);
            }
            else {
                deferred.reject();
            }
            return deferred.promise();
        },

        views: {
            // profile
            profile: {

                template: 'user/profile'

            },

            // user registration form
            register: {

                base: 'form',

                template: 'user/register'

            },

            // user logout
            logout: {

                populate: function () {
                    var self = this;
                    if (!this.model) {
                        return $.when();
                    }
                    this.$el.addClass('loading');
                    self.model.clear();
                    if (app.session) {
                        app.session.checkAuthentication().done(function () {
                            $.ajax({
                                url: self.model.url() + '/logout',
                                dataType: 'json',
                                contentType: 'application/x-www-form-urlencoded',
                                crossDomain: true,
                                xhrFields: {
                                    withCredentials: true // allow cross-domain credentials
                                },
                                type: 'POST'
                            }).always(function () {
                                app.session.logout(''); // log out session
                            });
                        }).fail(function () {
                            app.session.logout(''); // log out session
                        });
                    }
                    else {
                        // no session, just redirect to home page
                        app.router.navigate('', {trigger: true});
                    }
                }
            },

            // user login form
            login: {

                base: 'form',

                className: 'form-horizontal',

                template: 'user/login',

                events: {
                    'submit': 'onSubmit'
                },

                startLoading: function () {
                    $(".btn", this.$el).addClass("loading").css("text-indent", "-9999px");
                    return this;
                },

                stopLoading: function () {
                    $(".btn", this.$el).removeClass("loading").css("text-indent", "0");
                    return this;
                },

                onSubmit: function (event) {
                    var self = this, $target = $(event.target);
                    if (!this.model) {
                        return false;
                    }
                    else if (this.validate()) {
                        this.startLoading();

                        var values = this.getValues();

                        if (!app.session) {
                            app.session = new app.models.session();
                        }

                        app.session.isAuthenticated(function (loggedIn) {
                            if (!loggedIn) {
                                var data = {
                                    username: values.name,
                                    password: values.pass
                                }
                                data[app.session.idAttribute] = app.session.id;
                                self.model.id = null;
                                $.ajax({
                                    url: self.model.url() + '/login',
                                    data: data,
                                    dataType: 'json',
                                    contentType: 'application/x-www-form-urlencoded',
                                    crossDomain: true,
                                    xhrFields: {
                                        withCredentials: true // allow cross-domain credentials
                                    },
                                    type: 'POST'
                                }).done(function (data) {
                                    var dest = self.model ? self.model.destination : undefined;
                                    if (dest && dest.indexOf("?destination=") === 0) {
                                        dest = dest.substring("?destination=".length);
                                    }
                                    else {
                                        dest = '';
                                    }
                                    if (data.user) data.user.fetched = true; // set fetched flag
                                    app.session.login(data, dest);
                                }).fail(function () {
                                    $(".alert-error", $target).remove();
                                    $target.prepend(self.message("Invalid username or password", "error"));
                                    $(".control-group", $target).addClass("error");
                                }).always(function () {
                                    self.stopLoading();
                                });
                            }
                            else {
                                app.session.login(null, 'user');
                            }
                        }).fail(function () {
                            self.stopLoading();
                            $(".alert-error", $target).remove();
                            $target.prepend(self.message("Unable to initialise session.", "error"));
                            $(".control-group", $target).addClass("error");
                        });
                    }
                    return false;
                }

            }

        }
    };

    // session
    models.session = {

        resource: '/system/connect',

        idAttribute: 'sessid',

        initialize: function () {
            this.constructor.__super__.initialize.apply(this, arguments);

            // if Google analytics enabled, log session events
            if (app.utils.analytics && app.utils.analytics.trackEvent) {
                this.on('login', function () {
                    app.utils.analytics.trackEvent('Session', 'Login', this.getUserId()); // track event
                }, this);
                this.on('logout', function () {
                    app.utils.analytics.trackEvent('Session', 'Logout'); // track event
                }, this);
            }

            // initialize async authentication check
            this.checkAuthentication();
        },

        parse: function (response) {
            var attrs = {};

            if (response.user) {
                attrs.user = new app.models.user(response.user);
                attrs.user.id = parseInt(attrs.user.id); // ensure ID is integer

                if (attrs.user.id && (this.getUser() && !this.getUserId())) {
                    // trigger events
                    this.trigger('login', response);
                    app.trigger('session:login', this, response);
                }
            }
            return $.extend(response, attrs);
        },

        setUser: function (user) {
            this.set('user', user);
            return this;
        },

        getUser: function () {
            return this.get('user');
        },

        getUserId: function () {
            return this.get('user') ? this.get('user').id : 0;
        },

        login: function (data, destination) {
            if (data) {
                this.set(this.parse(data));
            }
            else {
                // trigger events
                this.trigger('login', data);
                app.trigger('session:login', this, data);
            }
            if (typeof (destination) === 'string') { // is redirect destination set?
                app.router.navigate(destination, {trigger: true});
            }
            return this;
        },

        logout: function (destination) {
            this.clear();
            this.trigger('logout'); // logout event
            app.trigger('session:logout', this); // global event
            if (typeof (destination) === 'string') { // is redirect destination set?
                app.router.navigate(destination, {trigger: true});
            }
            return this;
        },

        isAuthenticated: function (callback, check) {
            var self = this;

            // check service?
            if (check !== false) {
                return this.checkAuthentication().done(function () {
                    if (callback) {
                        callback(self.getUserId() > 0);
                    }
                }).fail(function () {
                    if (callback) {
                        callback(false);
                    }
                });
            }
            else {
                if (callback) {
                    callback(self.getUserId() > 0);
                }
                return self.getUserId() > 0;
            }
        },

        checkAuthentication: function () {
            // if request in progress, return existing
            if (this.deferred) {
                return this.deferred;
            }
            else if (this.getUser()) {
                return $.when();
            }

            var self = this;
            return this.deferred = this.save(null, {
                dataType: 'json',
                contentType: 'application/x-www-form-urlencoded',
                crossDomain: true,
                xhrFields: {
                    withCredentials: true // allow cross-domain credentials
                },
                type: 'POST'
            }).always(function () {
                self.deferred = undefined; // clear deferred
            }).fail(function () {
                app.trigger("session:error", "Unable to initialise session");
                self.trigger("error", "Unable to initialise session");
            });
        }
    };

    models.node = {
        resource: '/node',
        idAttribute: 'nid',
        
        // get node language
        getLanguage: function () {
            return this.get('language') || 'und';
        },
        
        // fetch taxonomy term field
        getTermReference: function (fieldName) {
            var field = this.get(fieldName), terms = [];
            if (field && field[this.getLanguage()]) {
                $.each(field[this.getLanguage()], function (i, value) {
                    if (typeof(value) === 'object' && value.tid) {
                        if (!value.term) {
                            if (value.taxonomy_term) {
                                value.term = new app.models.term(value.taxonomy_term);
                            } 
                            else {
                                value.term = new app.models.term();
                                value.term.id = value.tid;
                            }
                        }
                        terms.push(value.term);
                    }
                });
            }
            return terms;
        },

        models: { // children models
            investor: {
                
                // get market taxonomy terms
                getMarket: function () {
                    return this.getTermReference('field_market');
                },
                
                parse: function (response) {
                    var data = this.constructor.__super__.parse.apply(this, arguments) || {};
                    // handle distance formatting
                    if (data.distance) {
                        var dist = parseFloat(data.distance);
                        data.distance_rounded = dist.toPrecision(2);
                    }
                    return data;
                },
                
                collections: {
                    investors: {
                        resource: '/investors',

                        // fetch nearest investors to specified coords
                        fetchNearest: function (latitude, longitude, distance) {
                            // handle variables passed as object
                            // eg. fetchNearest({....}, distance);
                            if (typeof(latitude) === 'object') {
                                distance = longitude;
                                longitude = latitude.longitude;
                                latitude = latitude.latitude;
                            }
                            return this.fetch({
                                data: {
                                    distance: {
                                        latitude: latitude,
                                        longitude: longitude,
                                        search_distance: distance || 10 // default = 10km
                                    }
                                },
                                dataType: 'jsonp'
                            });
                        },
                        
                        views: {
                            map: {
                                id: 'map-container',
                                
                                initialize: function () {
                                    if (this.collection) {
                                        if ($.isFunction(this.collection)) {
                                            this.collection = new this.collection();
                                        }
                                        // bind collection events
                                        this.collection.on('reset', this.resetMarkers, this);
                                        this.collection.on('add', this.addMarker, this);
                                        this.collection.on('remove', this.removeMarker, this);
                                    }
                                    app.on("location:nearest", this.centerMap, this);
                                },

                                cleanup: function () {
                                    this.constructor.__super__.cleanup.apply(this, arguments);
                                    app.off(null, null, this);
                                },
                                
                                resetMarkers: function (collection) {
                                    locator.resetMarkers();
                                    collection.each(function (investor) {
                                        investor.marker = 
                                            locator.addMarker(investor.attributes);
                                    });
                                },
                                
                                add: function (item) {
                                    if (item) {
                                        item.marker = locator.addMarker(item.attributes); 
                                    }
                                },
                                
                                remove: function (item) {
                                    if (item) {
                                        locator.markers = _.filter(locator.markers || [], 
                                            function (marker) {
                                                return item.marker ? marker !== item.marker : false;
                                            }
                                        );
                                    }
                                },
                                
                                afterRender: function () {
                                    locator.initMap(this.id, this.el);
                                },
                               
                                // fix map
                                fixMap: function () {          
                                    locator.setBestView();
                                },
                                
                                // center map
                                centerMap: function (latitude, longitude) {
                                    if (typeof(latitude) === 'object') {
                                        longitude = latitude.longitude;
                                        latitude = latitude.latitude;
                                    }
                                    locator.centerMap(latitude, longitude);
                                }
                            },
                            investors: {
                                tagName: 'ul',
                                className: 'nav nav-tabs nav-stacked',
                                
                                //override the default rendering of the collection (all items)
                                populate: function () {
                                    return {};                                    
                                }
                            }
                        }
                    }
                },
                views: {
                    investor: {
                        
                        tagName: 'li',
                        template: 'investor',
                        
                                  
                        serialize: function () {
                            var data = this.constructor.__super__.serialize.apply(this, arguments);
                            // set teaser display mode
                            data.viewMode = {
                                teaser: true,
                                list: true
                            };
                            return data;
                        }
                    },
                    
                    investorFull: {
                        
                        tagName: 'div',
                        template: 'investor',

                        serialize: function () {
                            var data = this.constructor.__super__.serialize.apply(this, arguments);
                            // set full display mode
                            data.viewMode = {
                                full: true,
                                div: true
                            };
                            return data;
                        }
                    }
                }
            },
            article: {
                collections: {
                    news: {
                        resource: '/news',
                        views: {
                            news: {
                                events: {}
                            }
                        }
                    }
                },
                views: {
                    article: {
                        template: 'article'
                    }
                }
            }
        }
    };
            
    models.locatorResult = {
        fetch: false,
        collections: {
            locatorResults: {

                // override sync method to use Locator
                sync: function(method, model, options) {
                    var deferred = $.Deferred();
                    if (method === 'read' && model.address) {  
                        var address = $.trim($.isFunction(model.address) ? model.address() : model.address);
                        locator.geocodeSuccess = function (results) {
                            model.cached = {
                                address: address,
                                results: results
                            };
                            deferred.resolve(results);
                        };
                        locator.geocodeFail = deferred.reject;
                        if (model.cached && model.cached.address == address) {
                            deferred.resolve(model.cached.results);
                        }
                        else {
                            locator.geocode(address);
                        }          
                    }
                    else {
                        deferred.reject();
                    }
                    return deferred.promise().done(options.success);
                },
                
                setAddress: function (address) {
                    this.address = address;
                    return this;
                },

                views: {
                    locatorResults: {
                        tagName: 'ul',
                        className: 'nav nav-tabs nav-stacked',
                        initialize: function () {
                            this.constructor.__super__.initialize.apply(this, arguments);
                            app.on("location:select location:nearest", function () {
                                this.$el.hide();
                            }, this);
                        },

                        cleanup: function () {
                            this.constructor.__super__.cleanup.apply(this, arguments);
                            app.off(null, null, this);
                        },
                        
                        beforeRender: function () {
                            this.$el.empty();
                            if (this.collection) {
                                if (this.collection.length === 1) {
                                    var firstResult = this.collection.shift();
                                    app.trigger("location:nearest", {
                                        latitude: firstResult.get('geometry').location.lat(),
                                        longitude: firstResult.get('geometry').location.lng()
                                    });
                                }
                                else if (this.collection.length > 1) {
                                    this.collection.each(function (result) {
                                        this.insertView(new app.views.locatorResult({
                                            model: result
                                        }));
                                    }, this);
                                }
                            }
                        },
                        
                        afterRender: function () {
                            if (this.$el.is(":empty")) {
                                this.$el.hide();
                            }
                            else {
                                this.$el.show();
                            }
                        }
                    }
                }
            }
        },
        views: {
            locatorResult: {
                tagName: 'li',

                template: 'locator/result',

                events: {
                    'click a': 'onClick'
                },

                onClick: function (event) {
                    if (this.model) {
                        app.router.navigate("search/" + 
                            encodeURIComponent(this.model.get('formatted_address')), {
                            trigger: false
                        });
                        app.trigger("location:select", this.model);
                        app.trigger("location:nearest", {
                            latitude: this.model.get('geometry').location.lat(),
                            longitude: this.model.get('geometry').location.lng()
                        });
                    }
                    return false;
                },
                
                serialize: function () {
                    var data = this.model ? this.model.toJSON() : {};
                    if (data.formatted_address) {
                        data.formatted_address_encoded = encodeURIComponent(data.formatted_address);
                    }
                    return data;
                }

            }
        }
    };


    return models;
});
