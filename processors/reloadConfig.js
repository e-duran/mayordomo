"use strict";

exports.execute = function (req, res) {
    var db = global.getDB(res);
    var Config = require('../schemas/config.js');
    Config = db.model('Config');
    Config.findOne(function (err, config) {
        db.close();
        if (err) {
            res.send('Error while querying app configuration: ' + err);
            return;
        }
        global.config = config;
        res.json(config);
    });
};