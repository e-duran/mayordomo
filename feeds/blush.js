"use strict";

exports.generate = function (req, res) {
    var mongoose = require('mongoose'),
        Dancer = require('../schemas/dancer.js'),
        RSS = require('rss'),
        feed;
    res.type('xml');
    feed = new RSS({
        title: 'Blush dancers',
        description: 'Calendar of Blush dancers',
        feed_url: '{0}/rss/blush'.format(global.config.publicHost),
        site_url: 'http://www.blushexotic.com/girls/feature-dancers/',
        image_url: 'http://www.blushexotic.com/files/2014/12/favico_blush_noborder_logo1.png',
        language: 'en',
        pubDate: new Date()
    });

    mongoose.connect(global.config.mongoUrl);
    Dancer.find().limit(20).sort('-createdAt').exec().then(function (dancers) {
        var i;
        for (i = dancers.length - 1; i > -1; i--) {
            feed.item({
                title:  dancers[i].name,
                description: '<p><img src="{0}"></p><p>Event dates: {1}</p><p><a href="{2}">View full resolution photo</a></p>'.format(dancers[i].photoUrl, dancers[i].dates, dancers[i].fullResolutionPhotoUrl),
                url: dancers[i].url,
                guid: dancers[i]._id.toString(),
                author: 'Mayordomo',
                date: dancers[i].createdAt
            });
        }
        mongoose.connection.close();
        res.send(feed.xml({indent: true}));
    });
};