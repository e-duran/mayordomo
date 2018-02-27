'use strict';

exports.generate = async function (req, res) {
    var dancerStore = null;
    
    try {
        if (!global.config) global.config = await global.getConfig(); 
        var config = global.config;
        
        var Rss = require('rss');
        var feed = new Rss({
            title: config.dancersFeedTitle,
            description: config.dancersFeedDescription,
            feed_url: config.dancersFeedUrl,
            site_url: config.dancersSiteUrl,
            image_url: config.dancersFeedImageUrl,
            language: 'en',
            pubDate: new Date()
        });
        
        dancerStore = await global.getStore('dancers');
        var dancers = await dancerStore.find().sort('createdAt', -1).limit(20).toArray();
        dancerStore.client.close();
        for (var i = 0; i < dancers.length; i++) {
            feed.item({
                title:  dancers[i].name,
                description: `<p><img src="${dancers[i].photoUrl}"></p><p>Event dates: ${dancers[i].dates}</p>`,
                url: dancers[i].url,
                guid: dancers[i]._id.toString(),
                author: 'Mayordomo',
                date: dancers[i].createdAt
            });
        }
        
        res.type('xml');
        res.send(feed.xml({ indent: true }));
    } catch (e) {
        res.type('text/plain; charset=utf-8');
        global.log(res, 'Exception', e);
        if (dancerStore) {
            dancerStore.client.close();
        }
    }
};
