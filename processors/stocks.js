'use strict';

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');
    
    var log = function (message, error) { global.log(res, message, error) };
    var axios = require('axios');
    var cheerio = require('cheerio');
    
    try {
        if (!global.config) global.config = await global.getConfig(); 
        var config = global.config;
        var stockWatchList = config.stockWatchList.split(',');
        for (let i = 0; i < stockWatchList.length; i++) {
            var quote = stockWatchList[i].split('|')[0];
            var priceLimit = parseFloat(stockWatchList[i].split('|')[1]);
            var stockResponse = await axios.get('https://www.google.com/finance?q=' + quote);
            var $ = cheerio.load(stockResponse.data);
            var price = parseFloat($('.YMlKec.fxKbKc').eq(0).text().substr(1));
            var dateTime = $('.ygUjEc').eq(1).text();
            dateTime = dateTime.substring(0, dateTime.indexOf(' GMT'));
            if (isNaN(price)) {
                log(`Cannot find price information for stock ${quote}`);
                continue;
            }
            if (price >= priceLimit) {
                log(`Stock ${quote} is at ${price} as of ${dateTime}`);
                const mail = {
                    from: config.stockWatchListFrom,
                    to: config.stockWatchListTo,
                    subject: `Stock ${quote} is at ${price}`,
                    html: `The stock ${quote} is at or over the notification limit ${priceLimit} as of ${dateTime}<br>
                    See <a href="https://www.google.com/finance?q=${quote}">Finance</a> for more details`
                };
                await global.sendMail(config, mail, log);
            } else {
                log(`Stock ${quote} is at ${price}, which is under the limit ${priceLimit}, no further action taken.`);
            }
        }
        res.end();
    } catch (e) {
        log('Exception', e);
    }
};
