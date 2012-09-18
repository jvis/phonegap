// Filename: views.js
define([
    'jquery',
    'app',
    'backbone',
    'locator',
    //'plugins/bootstrap.custom'
], function ($, app, Backbone, locator) {

    var views = {};

    /**
    * Home view
    */
    views.home = {

        /**
        * define view properties
        * 
        * @see http://backbonejs.org/#View
        * @see https://github.com/tbranyen/backbone.layoutmanager
        */
        events: {},

        initialize: function () {
            this.constructor.__super__.initialize.apply(this, arguments); // call parent initialize

            // bind router hooks
            this.on("router:beforeRender", this.routerBeforeRender, this);
            this.on("router:afterRender", this.routerAfterRender, this);
        },

        /**
        * Template
        * 
        * @param string|object
        */
        template: 'home', // template name

        // Example template declaration with CSS:
        // 
        // template: {
        //    template: 'home',
        //    css: [
        //        'css1',
        //        'css2'
        //    ]
        // }

        /**
        * serialize, return data to template
        * 
        * @see https://github.com/tbranyen/backbone.layoutmanager#working-with-template-data
        */
        serialize: function () {
            return {
                code: JSON.stringify(app.init, null, '\t')
            }
        },

        // router before render hook
        routerBeforeRender: function (arg) {
            //app.log('router:beforeRender');
            //app.log(arg);
        },

        // router after render hook
        routerAfterRender: function (arg) {
            //app.log('router:afterRender');
            //app.log(arg);
        },

        /**
        * optional: define child views
        */
        views: {

            homeForm: {
                // optional: specify different base class to extend
                // by default this class would extend "app.views.home"
                base: app.views.form
            }
        }
    };

    /**
    * Menu view
    */
    views.menu = {

        /**
        * Template
        * 
        * @param string|object
        */
        template: 'menu', // template name

        initialize: function () {
            this.constructor.__super__.initialize.apply(this, arguments); // call parent initialize

            if (!app.session) {
                app.session = new app.models.session();
            }

            app.session.on('change', this.render, this);
        },

        setActivePage: function (page, view) {
            this.activePage = page;
            this.setTitle(page.attr('title') || page.data('title') || app.name);
            //this.setActions(view ? view.actions || [] : []);
        },

        setTitle: function (title) {
            $(".brand", this.el).text(title);
        },

        getActions: function () {
            if (!this.$actions) {
                this.$actions = $("#menu-actions", this.el);
            }
            return this.$actions;
        },

        serialize: function () {
            if (app.session && app.session.isAuthenticated(null, false)) {
                return {
                    user: app.session.getUser().toJSON(),
                    title: this.activePage ?
                        this.activePage.attr('title') || this.activePage.data('title') :
                            app.name
                }
            }
            return {};
        },

        setActions: function (actions) {
            var self = this,
                $actions = this.getActions(),
                $menu = $("ul.dropdown-menu", $actions);

            $actions.hide();
            $menu.empty();

            var added = false;

            $.each(actions, function (index, value) {
                var $link = $(self.make("a", {
                    "class": "action",
                    "title": value.title || "",
                    "href": value.href
                }, value.text));
                if (value.events) {
                    $.each(value.events, function (event, callback) {
                        $link.on(event, callback);
                    });
                }
                $menu.append(self.make('li', {}, $link));
                added = true;
            });

            if (added) {
                $actions.show();
            }
        }
    };

    // search view - handles main search logic
    views.search = {

        template: 'search',

        initialize: function () {
            this.constructor.__super__.initialize.apply(this, arguments);
            
            // initialize collections
            this.collections = {
                investors: new app.collections.investors(),
                locatorResults: new app.collections.locatorResults()
            };
            
            // router hooks
            this.on('router:beforeRender', this.routerBeforeRender, this);
            this.on('router:afterRender', this.routerAfterRender, this);
            
            // app hooks
            app.on("location:nearest", this.locationNearest, this);
            app.on("location:select", this.locationSelect, this);
            app.on("location:search", this.locationSearch, this);
            app.on("location:current", this.locationCurrent, this);
        },
        
        // location selected
        locationSelect: function (model) {
            if (typeof(model) === 'string') {
                this.getSearchForm().setInputValue(model);
            }
            else {
                this.getSearchForm().setInputValue(model.get('formatted_address'));
            }
        },
        
        // location nearest query
        locationNearest: function (latitude, longitude, distance) {
            var self = this;
            this.startLoading();
            return this.collections.investors.fetchNearest(latitude, longitude, distance).always(function () {
                self.stopLoading();
            });
        },
        
        // current location
        locationCurrent: function () {
            var self = this;
            this.startLoading();
            app.router.navigate("search/nearest", {trigger: false});
            return this.populate(undefined, "nearest").always(function () {
                self.stopLoading();
            });
        },
        
        // search for location
        locationSearch: function (input) {
            var self = this;
            this.startLoading();
            app.router.navigate("search/" + encodeURIComponent(input), {trigger: false});
            return this.populate(undefined, input).always(function () {
                self.stopLoading();
            });
        },
        
        // router:beforeRender hook
        routerBeforeRender: function (addressInput) {
            if (addressInput) {
                addressInput = decodeURIComponent(addressInput);
                
                this.addressInput = addressInput;
            }
        },
        
        // router:afterRender hook
        routerAfterRender: function (addressInput) {},
        
        populate: function (opts, args) {
            var self = this;
            if (args && args.length) {
                var input = decodeURIComponent(typeof(args) !== 'string' ? args.shift() : args);
                if (input === 'nearest') {
                    if (this.deferred && this.deferred.state() == 'pending') {
                        // if fetch already in progress, return existing
                        return this.deferred;
                    }
                    // asynchronously retrieve current location
                    this.deferred = $.Deferred();
                    this.getCurrentLocation().done(function (coords) {
                        self.collections.investors.fetchNearest(coords)
                            .done(self.deferred.resolve)
                            .fail(self.deferred.reject);
                    }).fail(this.deferred.reject);
                    return this.deferred.promise();
                }
                else {
                    return this.collections.locatorResults.setAddress(input).fetch(opts);
                }
            }
            return $.when();
        },
        
        getCurrentLocation: function () {
            var deferred = $.Deferred();
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function (data) {
                    if (data && data.coords) {
                        deferred.resolve(data.coords);
                    }
                    else {
                        deferred.reject("Unable to determine location");
                    }
                });
            }
            else {
                deferred.reject("Browser does not support geolocation");
            }
            return deferred;
        },
        
        cleanup: function () {
            this.constructor.__super__.cleanup.apply(this, arguments);
            app.off(null, null, this);
            var self = this;
            $.each(this.collections, function (index, value) {
                value.on(null, null, self);
            });
        },

        beforeRender: function () {
            // insert sub views
            this.insertView(new app.views.locatorResults({
                collection: this.collections.locatorResults
            }));
            this.insertView(new app.views.searchResults({
                collection: this.collections.investors
            }));
        },
        
        afterRender: function () {
            this.setView("#search-form-container", this.getSearchForm()).render();
        },
        
        getSearchForm: function () {
            if (this.searchForm) {
                return this.searchForm;
            }
            // add search view
            this.searchForm = this.searchView || app.views.searchForm || app.views.form;
            // initialize 
            var self = this;
            this.searchForm = new this.searchForm({
                el: '#search-form',
                
                attributes: {
                    "data-input": self.addressInput  // pass URL argument to form
                }
            });
            
            return this.searchForm;
        },

        startLoading: function () {
            var searchForm = this.getSearchForm();
            if (searchForm && searchForm.startLoading) {
                searchForm.startLoading();
            }
            return this;
        },

        stopLoading: function () {
            var searchForm = this.getSearchForm();
            if (searchForm && searchForm.stopLoading) {
                searchForm.stopLoading();
            }
            return this;
        }
    };
    
    // search form
    views.searchForm = {
        base: 'form',
              
        events: {
            'submit': 'onSubmit',
            'click #search-nearest-btn': 'onClickNearest',
            'focus input': 'onFocus',
            'blur input': 'onBlur'
        },
         
        setPlaceholder: function (placeholder) {
            var $input = this.getInput();
            if ($input.attr("placeholder") != placeholder) {
                $input.data("placeholder", $input.attr("placeholder")); // store existing placeholder
            }
            $input.attr("placeholder", placeholder);
            return this;
        },
        
        getInput: function () {
            if (!this.input || this.input.length == 0) {
                this.input = $('#search-input', this.$el);
            }
            return this.input;
        },
        
        setInputValue: function (val) {
            return this.getInput().val(val);
        },
        
        onClickNearest: function (event, trigger) {
            var $input = this.getInput();
            this.setPlaceholder("    Current location");
            $input.val('');
            $input.closest('.control-group').removeClass('error');
            $input.closest('form').addClass("nearest");
            if (trigger !== false) {
                app.trigger("location:current");
            }
            return false;
        },
        
        
        onSubmit: function (event) {
            if (this.validate()) {
                var $input = this.getInput(), input = $input.val();
                if ($input.data('placeholder')) { // restore placeholder
                    $input.attr("placeholder", $input.data("placeholder"));
                }
                $input.closest('.control-group').removeClass('error');
                app.router.navigate("search/" + encodeURIComponent(input), {trigger: false});
                if ($input.data('coords')) {
                    // use cached longitude / latitude values, if available
                    app.trigger("location:nearest", $input.data('coords'));
                }
                else {
                    // search for location
                    app.trigger("location:search", input);
                }
            }
            return false;
        },
        
        onFocus: function (event) {
            var $input = $(event.target);
            if ($input.closest("form").hasClass("nearest")) {
                $input.data("nearest", $input.attr("placeholder"));
                $input.attr("placeholder", $input.data("placeholder"));
                $input.closest('form').removeClass("nearest");
            }
        },
        
        onBlur: function (event) {
            var $input = $(event.target);
            if ($input.data("nearest") && $input.val() == '') {
                this.setPlaceholder($input.data("nearest"));
                $input.closest('form').addClass("nearest");
            }
        },
        
        afterRender: function () {
            this.delegateEvents();

            if (this.attributes && this.attributes['data-input']) {
                if (this.attributes['data-input'] === 'nearest') {
                    this.getInput().val('');
                    this.onClickNearest(undefined, false);
                }
                else {
                    this.getInput().val(this.attributes['data-input']);
                }
            }
            
            // create Bootstrap typeahead
//            $input.typeahead({
//                addressCache: {},
//                source: function (query, process) {
//                    self.startLoading();
//                    if ($input.data('timer')) {
//                        clearTimeout($input.data('timer'));
//                    }
//                    var typeahead = this, source = function () {
//                        typeahead.options.addressCache = {};
//                        self.populate({silent: true}, query).done(function (results) {
//                            if (results && results.length) {
//                                process($.map(results, function (item) {
//                                    if (item.geometry && typeahead && typeahead.options.addressCache) {
//                                        typeahead.options.addressCache[item.formatted_address] = {
//                                            latitude: item.geometry.location.lat(),
//                                            longitude: item.geometry.location.lng()
//                                        }
//                                    }
//                                    return item.formatted_address;
//                                }));
//                            }
//                        }).always(function () {
//                            self.stopLoading();
//                        });
//                    }
//                    $input.data('timer', setTimeout(source, 300)); // wait for 300msecs
//                },
//                updater: function (selected) {
//                    $input.data('selected', true);
//                    if (this.options.addressCache && this.options.addressCache[selected]) {
//                        $input.data('coords', this.options.addressCache[selected]);
//                    }
//                    return selected;
//                },
//                minLength: 4,
//                items: 10
//            }).change(function () {
//                var $this = $(this);
//                if ($this.data('selected')) { // if value selected, submit form
//                    $this.closest('form').submit();
//                }
//                $this.data('coords', null);
//                $this.data('selected', false);
//            });
            
        },

        startLoading: function () {
            this.getInput().addClass("loading").css("background-position", "98%");
            return this;
        },

        stopLoading: function () {
            this.getInput().removeClass("loading").css("background-position", null);
            return this;
        }
    };

    // search results
    views.searchResults = {
        template: 'search/results',
        
        id: 'search-results',
        
        className: 'results-panel',
        
        events: {
            'click #results-selector .btn': 'onClick',
            'shown #results-selector .btn': 'onShown' // after tab shown
        },
              
        initialize: function () {
            app.on("location:select location:nearest location:current", function () {
                this.showList();
            }, this);
            
            if (this.collection) {
                // show / hide buttons
                this.collection.on('reset add remove', function () {
                    if (this.collection.length > 0) {
                        this.showButtons();
                    }
                    else {
                        this.hideButtons();
                    }
                }, this);
            }
        },

        cleanup: function () {
            this.constructor.__super__.cleanup.apply(this, arguments);
            app.off(null, null, this);
            this.listView = undefined;
            this.mapView = undefined;
        },
        
        onShown: function (e) {
            this.getView(function (view) {
                if (view && view.fixMap) {
                    view.fixMap();
                }
            });
        },
        
        showButtons: function () {
            $("#results-selector", this.$el).show();
        },
        
        hideButtons: function () {
            $("#results-selector", this.$el).hide();
        },
        
        showList: function () {
            $("#results-list-btn", this.$el).click();
        },
        
        onClick: function (e) {
            e.preventDefault();
            $(e.target).tab('show').button('toggle')
            return false;
        },
        
        beforeRender: function () {
            this.listView = this.setView("#results-list", new app.views.investors({ 
                collection: this.collection
            }));
            this.mapView = this.setView("#results-map", new app.views.map({ 
                collection: this.collection
            }));
        },
        
        afterRender: function () {
            // hide buttons if no results
            if (!this.collection || this.collection.length === 0) {
                this.hideButtons();
            }
        }
    }

    return views;
});
