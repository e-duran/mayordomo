"use strict";

exports.execute = function (req, res) {
    var Promise = require("bluebird"),
        request = Promise.promisifyAll(require("request")),
        moment = require('moment-timezone'),
        now = moment().tz('America/New_York'),
        stylistId = global.config.stylistId,
        stylistName = global.config.stylistName,
        Stylist = require('../schemas/stylist.js'),
        today = moment(now).startOf('day'),
        tomorrow = moment(today).add(1, 'day'),
        lastTime,
        stylistInfo,
        stylistModel;

    res.type('text');
    if (now.hour() < 9 || now.hour() >= 21) {
        res.write('Skipped processing due to out of business hours\n');
        res.end();
        return;
    }
    
    request.getAsync(global.config.stylistInfoUrl)
    .spread(function (response, body) {
        if (response.statusCode !== 200) { return Promise.reject('Cannot get list of stylists: got {0} status code and response body \n\n{1}'.format(response.statusCode, body)); }
        
        stylistInfo = JSON.parse(body).find(function (stylist) {
            return stylist.employeeID == stylistId;
        });
        if (stylistInfo) {
            if (stylistInfo.name != stylistName) { res.write('Stylist {0} name is not {1}\n'.format(stylistId, stylistName)); }
            lastTime = moment(now).add(moment.duration(stylistInfo.availableTime.replace(' hrs ', ':').replace(' mins', '')).add(1, 'minute')).startOf('minute');
        }
        if (lastTime) {
            lastTime = lastTime.toDate();
            return Stylist.findOne({ stylistId: stylistId, createdAt: { $gte: today, $lt: tomorrow } }).exec();
        } else {
            return Promise.reject('Stylist {0} is not available'.format(stylistId));
        }
    })
    .then(function (existingStylist) {
        if (existingStylist) {
            existingStylist.lastTime = lastTime;
            stylistModel = existingStylist;
        } else {
            stylistModel = new Stylist({ stylistId: stylistId, stylistName: stylistName, lastTime: lastTime, createdAt: now.toDate() });
        }
        return Promise.promisify(stylistModel.save, stylistModel)();
    })
    .spread(function (stylist) {
        res.write('Saved stylist {0} last time {1}'.format(stylist.stylistId, stylist.lastTime));
    })
    .catch(function (error) {
        if (error.stack) {
            res.write('Unhandled ' + error.stack);
        } else {
            res.write(error);
        }
    })
    .finally(function () {
        res.write('\nEnd of processing.\n');
        res.end();
    });
};