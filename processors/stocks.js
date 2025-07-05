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
            var quoteType = quote.indexOf(':') > 0 ? 'Stock' : 'Exchange rate';
            var priceLimit = parseFloat(stockWatchList[i].split('|')[1]);
            var stockResponse = await axios.get('https://www.google.com/finance?q=' + quote);
            var $ = cheerio.load(stockResponse.data);
            var priceClasses = config.stockWatchListPriceClasses || '.YMlKec.fxKbKc';
            var priceText = $(priceClasses).eq(0).text();
            var price = parseFloat(priceText);
            price = isNaN(price) ? parseFloat(priceText.substring(1)) : price;
            if (isNaN(price)) {
                log(`Cannot find price information for ${quoteType.toLowerCase()} ${quote}`);
                continue;
            }
            var dateTimeClass = config.stockWatchListDateTimeClass || '.ygUjEc';
            var dateTime = $(dateTimeClass).last().text();
            var dateTimeSeparator = config.stockWatchListDateTimeSeparator || ' · ';
            var separatorIndex = dateTime.indexOf(dateTimeSeparator);
            if (separatorIndex < 0) {
                log(`Cannot find expected separator '${dateTimeSeparator}' after date/time`);
                separatorIndex = dateTime.length;
            }
            dateTime = dateTime.substring(0, separatorIndex);
            
            if (price >= priceLimit) {
                log(`${quoteType} ${quote} is at or greater than ${price} as of ${dateTime}`);
                const mail = {
                    from: config.stockWatchListFrom,
                    to: config.stockWatchListTo,
                    subject: `${quoteType} ${quote} is at or greater than ${price}`,
                    html: `The ${quoteType.toLowerCase()} ${quote} is at or over the notification limit ${priceLimit} as of ${dateTime}<br>
                    See <a href="https://www.google.com/finance?q=${quote}">Finance</a> for more details`
                };
                await global.sendMail(res, config, mail, log);
            } else {
                log(`${quoteType} ${quote} is at ${price}, which is under the notification limit ${priceLimit}, no further action taken.`);
            }
        }
        res.end();
    } catch (e) {
        log('Exception', e);
    }
};
