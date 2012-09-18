// Set the require.js configuration for your application.
require.config({

    // Initialize the application with the main application file.
    deps: ["main"],

    paths: {
        // JavaScript folders.
        libs: "../js/libs",
        plugins: "../js/plugins",
        vendor: "../vendor",

        // Libraries.
        jquery: "../js/libs/jquery.min",
        lodash: "../js/libs/lodash.min",
        backbone: "../js/libs/backbone.min",
        bootstrap: "../js/libs/bootstrap.min",
        handlebars: "../js/libs/handlebars",
        icanhaz: "../js/libs/icanhaz",
        async: "../js/libs/async",
        locator: "../js/libs/locator",
        gmaps: "../js/libs/gmaps"
    },

    shim: {
        // Backbone library depends on lodash and jQuery.
        jquery: {
            exports: 'jQuery'
        },

        backbone: {
            deps: ["lodash", "jquery"],
            exports: "Backbone"
        },
        
        // bootstrap depends on jQuery
        bootstrap: {
            deps: ['jquery']
        },
        
        handlebars: {
            exports: "Handlebars"
        },
        
        icanhaz: {
            exports: "ich"
        },
        
        gmaps: {
            exports: 'google'
        },
        
        locator: {
            deps: ['gmaps']
        },

        // Backbone.LayoutManager depends on Backbone.
        "plugins/backbone.layoutmanager.min": ["backbone"],
        "plugins/backbone.layoutmanager": ["backbone"],
        
        // Backbone.LocalStorage depends on Backbone.
        "plugins/backbone.localStorage.min": ["backbone"],
        "plugins/backbone.localStorage": ["backbone"],
        
        // Bootstrap.custom depends on Bootstrap
        "plugins/bootstrap.custom": ["bootstrap"]
    }

});
