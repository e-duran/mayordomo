'use strict';

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');
    
    var log = function (message, error) { global.log(res, message, error) };
    var stylistStore = null;
    
    try {
        if (!global.config) global.config = await global.getConfig(); 
        var config = global.config;
        var stylistId = config.stylistId;
        var stylistName = config.stylistName;
        var moment = require('moment-timezone');
        var now = moment().tz('America/New_York');
        
        if (now.hour() < 9 || now.hour() >= 21) {
            log('Skipped processing due to out of business hours');
            res.end();
            return;
        }
        
        var axios = require('axios');
        var stylistResponse = await axios.get(config.stylistInfoUrl);
        var stylistInfo = stylistResponse.data.find(function (stylist) {
            return stylist.employeeID == stylistId;
        });
        if (!stylistInfo) {
            log(`Stylist ${stylistId} is not available.`);
            res.end();
            return;
        }
        if (stylistInfo.name != stylistName) {
            log(`Name of stylist ${stylistId} is not ${stylistName}`);
        }
        
        var lastTime = moment(now).add(moment.duration(stylistInfo.availableTime.replace(' hrs ', ':').replace(' mins', '')).add(1, 'minute')).startOf('minute');
        var endOfShift = lastTime.format('h:mm:ss a');
        var today = moment(now).startOf('day');
        var tomorrow = moment(today).add(1, 'day');
        
        stylistStore = await global.getStore('stylists');
        var stylist = await stylistStore.findOne({ stylistId: stylistId, createdAt: { $gte: today.toDate(), $lt: tomorrow.toDate() } });
        var result;
        if (stylist) {
            result = await stylistStore.updateOne({ stylistId: stylistId}, { $set: { lastTime: lastTime.toDate(), modifiedAt: new Date() } });
            log(`Updated stylist ${stylistInfo.name} (ID ${stylistId}) with end of shift at ${endOfShift}`);
        } else {
            stylist = { stylistId: stylistId, name: stylistInfo.name, lastTime: lastTime.toDate(), createdAt: now.toDate() };
            result = await stylistStore.insertOne(stylist);
            log(`Created entry ${result.insertedId} for stylist ${stylistInfo.name} (ID ${stylistId}) with end of shift at ${endOfShift}`);
        }
        stylistStore.client.close();
        res.end();
    } catch (e) {
        log('Exception', e);
        if (stylistStore) {
            stylistStore.client.close();
        }
    }
};
