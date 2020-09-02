'use strict';

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');
    
    let logStore;
    try {
        if (!global.config) {
            global.config = await global.getConfig();
        }
        
        let name = req.query.processorName;
        let processorPath = global.processorsMap[name];
        
        if (name === 'ping') {
            res.send('pong');
            return;
        }
        if (!processorPath) {
            res.send(`No processor found with name "${name}"`);
            return;
        }
        
        let url = global.config.publicHost + processorPath;
        let axios = require('axios');
        axios.get(url).then(async function (response) {
            logStore = await global.getStore('logs');
            let logEntry = { category: name , data: response.data, timestamp: new Date() };
            let result = await logStore.insertOne(logEntry);
            console.log(`Log entry created with ID ${result.insertedId}`);
            logStore.client.close();
        });
        res.send('Called processor ' + name);
    } catch (e) {
        global.log(res, `Unhandled exception while calling processor ${name} - `, error);
        if (logStore) {
            logStore.client.close();
        }
    }
};
