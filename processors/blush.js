'use strict';

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');
    
    var log = function (message, error) { global.log(res, message, error) };
    var dancerStore = null;
    
    try {
        if (!global.config) global.config = await global.getConfig(); 
        var config = global.config;
        
        var axios = require('axios');
        var dancersPageResponse = await axios.get(config.dancersWebPage);
        
        var cheerio = require('cheerio');
        var $ = cheerio.load(dancersPageResponse.data);
        var dancers = [];
        $('.services-box').each(function (i, element) {
            var $pe = $(element);
            var dancer = {
                name: $pe.find('.sc-wraper h3 a').text(),
                dates: $pe.find('.sc-wraper p').text(),
                url: $pe.find('.sc-wraper h3 a').attr('href'),
                photoUrl: $pe.find('.img-container img').attr('src'),
                createdAt: new Date()
            };
            
            if (!dancer.name) throw new Error('Cannot find dancer name');
            if (!dancer.dates) throw new Error('Cannot find dancer event dates');
            if (!dancer.url) throw new Error('Cannot find dancer event URL');
            if (!dancer.photoUrl) throw new Error('Cannot find dancer photo URL');
            
            dancers[i] = dancer;
        });
        if (dancers.length == 0) log('Error: Initial selector did not return any nodes');
        
        dancerStore = await global.getStore('dancers');
        for (let i = 0; i < dancers.length; i++) {
            let dancer = dancers[i];
            var existingDancer = await dancerStore.findOne({ name: dancer.name, dates: dancer.dates });
            if (existingDancer) {
                log(`Event information for ${dancer.name} already exists`);
                continue;
            }
            var result = await dancerStore.insertOne(dancer);
            log(`Event information for ${dancer.name} created with ID ${result.insertedId}`);
        }
        dancerStore.client.close();
        
        log(`Finished processing event information for ${dancers.length} dancers.`);
        res.end();
    } catch (e) {
        log('Exception', e);
        if (dancerStore) {
            dancerStore.client.close();
        }
    }
};
