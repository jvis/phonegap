// Filename: appConfig.js

define([
    'includes/views',
    'includes/models',
    'includes/collections'
], function (views, models, collections) {
    
    /**
     * Application configuration
     */
    var appConfig = {
        root: '/mobile/',
        name: 'Fortbridge',
        dataStore: {
            baseUrl: 'http://dev.fortbridge.gotpantheon.com',
            endpoint: '/rest',
            dataType: 'jsonp'
        },
        selectors: {
            page: '#root', // layout
            menu: '#menu',
            sections: 'section.page',
            defaultSection: '#home'
        },
        layoutSettings: {
            name: 'page', // layout name
            template: {
                template: 'page', // template name
                css: [] // required CSS files (without .css extension)
            },
            content: 'page-content' // content element ID
        },
        container: 'page',
        utils: {
            templateLoader: {
                settings: {
                    path: 'templates/'
                }
            }
        },
        views: views, // includes/views.js
        models: models, // includes/models.js
        collections: collections // includes/collections.js
    };

    return appConfig;
    
});