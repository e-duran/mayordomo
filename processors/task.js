'use strict';

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');
    
    var log = function (message, error) { global.log(res, message, error) };
    var logStore = null;
    
    try {
        if (!global.config) global.config = await global.getConfig(); 
        var name = req.query.processorName;
        var processorPath = global.processorsMap[name];
        if (!processorPath) {
            res.send(`No processor found for task "${name}"`);
            return;
        }
        if (name === 'ping') {
            res.send('pong');
            return;
        }
        var url = global.config.publicHost + processorPath;
        var axios = require('axios');
        axios.get(url).then(async function (response) {
            logStore = await global.getStore('logs');
            var logEntry = { category: name , data: response.data, timestamp: new Date() };
            var result = await logStore.insertOne(logEntry);
            console.log(`Log entry created with ID ${result.insertedId}`);
            logStore.client.close();
        });
        res.send('Called processor ' + name);
    } catch (e) {
        log('Exception', e);
        if (logStore) {
            logStore.client.close();
        }
    }
};
