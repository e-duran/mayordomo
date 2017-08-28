"use strict";

exports.execute = function (req, res) {
    var Promise = require("bluebird"),
        cheerio = require('cheerio'),
        request = Promise.promisify(require('request')),
        Mailgun = require('mailgun-js'),
        mailgun = new Mailgun({apiKey: global.config.mailgunApiKey, domain: global.config.mailgunDomain}),
        stocks = global.config.stockWatchList.split(','),
        requestStockPromises = stocks.map(function (stock) {
            var quote = stock.split('|')[0];
            return request('https://www.google.com/finance?q=' + quote);
        });
    res.type('text');
    Promise.settle(requestStockPromises)
    .then(function (requestStockPromiseResults) {
        requestStockPromiseResults.forEach(function (requestStockPromiseResult, i) {
            var quote = global.config.stockWatchList.split(',')[i].split('|')[0],
                priceLimit = parseFloat(global.config.stockWatchList.split(',')[i].split('|')[1]),
                response,
                $,
                price,
                dateTime,
                data = {
                    from: global.config.stockWatchListFrom,
                    to: global.config.stockWatchListTo,
                    subject: 'Stock {0} is at {1}',
                    html: 'The stock {0} is at or over the notification limit {1} as of {2}<br>See https://www.google.com/finance?q={3} for more details'
                };
            if (requestStockPromiseResult.isFulfilled()) {
                response = requestStockPromiseResult.value()[0];
                if (response.statusCode == 200 && response.body) {
                    $ = cheerio.load(response.body);
                    price = parseFloat($('span.pr').text());
                    dateTime = $('span.datetime').text();
                    if (price >= priceLimit) {
                        res.write('Stock {0} is at {1} as of {2}\r\n'.format(quote, price, dateTime));
                        data.subject = data.subject.format(quote, price);
                        data.html = data.html.format(quote, priceLimit, dateTime, quote);
                        mailgun.messages().send(data, function (error, body) {
                            if (error) {
                                console.log(error);
                            }
                        });
                    } else {
                        res.write('Stock {0} is under the limit {1}, nothing to see.\r\n'.format(quote, priceLimit));
                    }
                } else {
                    res.write('Error while getting quote info from Google, got status code {0} and body {1}'.format(response.statusCode, response.body || ''));
                }
            } else {
                res.write('Error while getting quote info from Google: {0}\r\n'.format(requestStockPromiseResult.reason()));
            }
        });
        res.end();
    });
};