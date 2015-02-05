"use strict";

var models = require('../models');
var RSS = require('rss');

exports.generate = function(req, res) {
    res.set('Content-Type', 'text/xml');
    var feed = new RSS({
        title: 'Blush dancers',
        description: 'Calendar of Blush dancers',
        feed_url: 'https://mayordomo-eadl.c9.io/rss/blush',
        site_url: 'http://www.blushexotic.com/girls/feature-dancers/',
        image_url: 'http://www.blushexotic.com/files/2014/12/favico_blush_noborder_logo1.png',
        language: 'en',
        pubDate: new Date()
    });
    
    models.Dancer.findAll( { order: 'startDate DESC', limit: 20 } ).then(function(dancers) {
        for (var i = dancers.length - 1; i > -1 ; i--) {
            feed.item({
                title:  dancers[i].name,
                description: '<p><img src="{0}"></p><p>Event dates: {1}</p><p><a href="{2}">View full resolution photo</a></p>'.format(dancers[i].photoUrl, dancers[i].dates, dancers[i].fullResolutionPhotoUrl),
                url: dancers[i].url,
                //guid: dancers[i].id,
                author: 'Mayordomo',
                date: dancers[i].updatedAt
            });
        }
        res.send(feed.xml({indent: true}));
    });
}