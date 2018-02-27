'use strict';

exports.execute = async function (req, res) {
    try {
        let config = await global.getConfig();
        if (config) {
            global.config = config;
            res.send('Configuration reloaded.');
        }
    } catch (err) {
        res.send('Cannot reload configuration  - ' + err.stack);
    }
};
