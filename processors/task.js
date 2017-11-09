"use strict";

exports.execute = function (req, res) {
    global.getConfig().then(function (config) {
        var name = req.query.processorName;
        var processorPath = global.processorsMap[name];
        var url = config.publicHost + processorPath;
        var request = require('request');
        var fs = require('fs');
        res.type('text');
        request(url, function (error, response, body) {
            if (error) {
                return console.log('Error while requesting ' + url + ': ' + error);
            }
            if (response.statusCode != 200 && !body) {
                body = 'Got error status code: ' + response.statusCode;
            }
            fs.writeFile('/tmp/task-' + name + '.log', body, function(error) {
                if (error) {
                    return console.log('Error writing task ' + name + ' log file: ' + error);
                }
            });
        });
        res.send('Called processor ' + name);
    });
};