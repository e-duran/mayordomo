"use strict";

var RSS = require('rss');

exports.generate = function(req, res) {
    res.send("I got: " + req.params.id);
    /*res.type('xml');
    var feed = new RSS({
        title: 'Movies',
        description: 'Calendar of movies',
        feed_url: 'https://mayordomo-eadl.c9.io/rss/test',
        site_url: 'http://www.firstshowing.net/schedule2015/',
        image_url: 'http://media2.firstshowing.net/firstshowing/images/FirstShowing-MinLogoRcopv1-12.png',
        language: 'en',
        pubDate: new Date()
    });
    
    
    feed.item({
            title:  'Movie title',
            description: '<form method="POST"><button type="button" name="a" value="like" /></form>'.format(dancers[i].photoUrl, dancers[i].dates, dancers[i].fullResolutionPhotoUrl),
            url: 'http://www.firstshowing.net/schedule2015/',
            //guid: dancers[i].id,
            author: 'Mayordomo',
            date: new Date()
        });
    res.send(feed.xml({indent: true}));*/
}