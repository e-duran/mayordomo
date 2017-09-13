"use strict";

exports.generate = function (req, res) {
    var db = global.getDB(res),
        Dancer = require('../schemas/dancer.js'),
        Rss = require('rss'),
        feed;
    Dancer = db.model('Dancer');
    res.type('xml');
    feed = new Rss({
        title: 'Blush',
        description: 'Calendar of events at Blush',
        feed_url: '{0}/rss/blush'.format(global.config.publicHost),
        site_url: 'http://www.blushexotic.com/girls/feature-dancers/',
        image_url: 'http://www.blushexotic.com/files/2014/12/favico_blush_noborder_logo1.png',
        language: 'en',
        pubDate: new Date()
    });
    Dancer.find().limit(20).sort('-createdAt').exec().then(function (dancers) {
        db.close();
        var i;
        for (i = 0; i < dancers.length; i++) {
            feed.item({
                title:  dancers[i].name,
                description: '<p><img src="{0}"></p><p>Event dates: {1}</p><p><a href="{2}">View full resolution photo</a></p>'.format(dancers[i].photoUrl, dancers[i].dates, dancers[i].fullResolutionPhotoUrl),
                url: dancers[i].url,
                guid: dancers[i].id,
                author: 'Mayordomo',
                date: dancers[i].createdAt
            });
        }
        res.send(feed.xml({indent: true}));
    });
};