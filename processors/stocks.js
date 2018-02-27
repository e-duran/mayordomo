'use strict';

exports.execute = async function (req, res) {
    res.type('text/plain; charset=utf-8');
    
    var log = function (message, error) { global.log(res, message, error) };
    var axios = require('axios');
    var cheerio = require('cheerio');
    var Mailgun = require('mailgun-js');
    
    try {
        if (!global.config) global.config = await global.getConfig(); 
        var config = global.config;
        var mailgun = new Mailgun({apiKey: config.mailgunApiKey, domain: config.mailgunDomain});
        
        var stockWatchList = config.stockWatchList.split(',');
        for (let i = 0; i < stockWatchList.length; i++) {
            var quote = stockWatchList[i].split('|')[0];
            var priceLimit = parseFloat(stockWatchList[i].split('|')[1]);
            var stockResponse = await axios.get('https://www.google.com/finance?q=' + quote);
            var $ = cheerio.load(stockResponse.data);
            var price = parseFloat($('span[style="font-size:157%"]').text());
            var dateTime = $('.f').first().text() || new Date().toDateString();
            if (isNaN(price)) {
                log(`Cannot find price information for stock ${quote}`);
                continue;
            }
            if (price >= priceLimit) {
                log(`Stock ${quote} is at ${price} as of ${dateTime}`);
                var mail = {
                    from: config.stockWatchListFrom,
                    to: config.stockWatchListTo,
                    subject: `Stock ${quote} is at ${price}`,
                    html: `The stock ${quote} is at or over the notification limit ${priceLimit} as of ${dateTime}<br>
                    See <a href="https://www.google.com/finance?q=${quote}">Finance</a> for more details`
                };
                mailgun.messages().send(mail, function (error, body) {
                    if (error) {
                        console.log(error);
                        log('Error while sending mail', error);
                    }
                });
            } else {
                log(`Stock ${quote} is under the limit ${priceLimit}, nothing to see.`);
            }
        }
        res.end();
    } catch (e) {
        log('Exception', e);
    }
};
