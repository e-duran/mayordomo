"use strict";

function error(res, message) {
    res.write(message);
    res.end();
}

function createDancers(res, Promise, dancers, Dancer, findDancerPromiseResults) {
    var promises = findDancerPromiseResults.map(function (findDancerResult, index) {
        var errorMessage,
            rejectionReason,
            dancerExists,
            dancer = dancers[index];
        if (findDancerResult.isFulfilled()) {
            dancerExists = findDancerResult.value() !== null;
            if (dancerExists) {
                errorMessage = "Dancer {0} already exists\r\n".format(dancer.name);
                res.write(errorMessage);
                return Promise.resolve({ dancerExists: true });
            }
            return Dancer.create(dancer);
        }
        rejectionReason = findDancerResult.reason();
        if (rejectionReason.handled === undefined) {
            errorMessage = "Error while finding dancer {0}: {1}\r\n".format(dancer.name, rejectionReason);
            res.write(errorMessage);
        }
        return Promise.reject({ handled: true });
    });
    return promises;
}

exports.execute = function (req, res) {
    var request = require('request');
    res.type('text');
    request('http://www.blushexotic.com/girls/feature-dancers/', function (requestError, response, body) {
        var Promise = require("bluebird"),
            Dancer = require('../schemas/dancer.js'),
            xpath = require('xpath'),
            Dom = require('xmldom').DOMParser,
            thisYear = new Date().getFullYear(),
            startContentIndex,
            endContentIndex,
            content,
            doc,
            nodes,
            dancers,
            i,
            classAttribute,
            nameNode,
            name,
            datesNode,
            dates,
            urlNode,
            url,
            photoUrlNode,
            photoUrl,
            fullResolutionPhotoUrl,
            dashIndex,
            startDate,
            endDate,
            spaceIndex,
            findDancerPromises;

        if (!requestError && response.statusCode === 200) {
            res.write("Retrieved feature dancers Web page via GET request\r\n");
            startContentIndex = body.indexOf('<div id="full-width" class="content">');
            endContentIndex = body.indexOf('<!-- end main content holder (#content/#full-width) -->', startContentIndex);
            if (startContentIndex < 0 || endContentIndex < 0) {
                return error(res, "Cannot find dancers content");
            }
            content = body.substring(startContentIndex, endContentIndex);
            content = content.replace(/&nbsp;/g, '');
            res.write("Content for parsing:\r\n" + content + "\r\n");

            doc = new Dom().parseFromString(content);
            nodes = xpath.select("/div/div/div/div/div", doc);
            if (!nodes || nodes.length === 0) {
                return error(res, "Cannot find individual dancers content");
            }
            dancers = [];
            for (i = 1; i < nodes.length; i++) {
                classAttribute = xpath.select1("/div/div/div/div/div[" + i + "]/@class", doc);
                if (!classAttribute || classAttribute.value.indexOf('services-no-content') > -1 || classAttribute.value.indexOf('clear') > -1) {
                    continue;
                }

                nameNode = xpath.select1("/div/div/div/div/div[" + i + "]/a/div/img/@alt", doc);
                name = !nameNode ? null : nameNode.value;
                datesNode = xpath.select("/div/div/div/div/div[" + i + "]/div/div/p/text()", doc);
                dates = !datesNode ? null : datesNode.toString();
                urlNode = xpath.select1("/div/div/div/div/div[" + i + "]/a/@href", doc);
                url = !urlNode ? null : 'http://www.blushexotic.com' + urlNode.value;
                photoUrlNode = xpath.select1("/div/div/div/div/div[" + i + "]/a/div/img/@src", doc);
                photoUrl = !photoUrlNode ? null : photoUrlNode.value;
                fullResolutionPhotoUrl = null;

                if (!name) {
                    return error(res, "Cannot find name for dancer");
                }
                if (!dates) {
                    return error(res, "Cannot find dates for dancer");
                }
                if (!url) {
                    return error(res, "Cannot find URL for dancer");
                }
                if (!photoUrl) {
                    return error(res, "Cannot find photo URL for dancer");
                }
                dashIndex = photoUrl.lastIndexOf('-');
                if (dashIndex > 0) {
                    fullResolutionPhotoUrl = photoUrl.substring(0, dashIndex) + '.jpg';
                }

                dashIndex = dates.indexOf('-');
                if (dashIndex > 0) {
                    startDate = new Date('{0}, {1}'.format(dates.substring(0, dashIndex), thisYear));
                    spaceIndex = dates.indexOf(' ');
                    endDate = new Date('{0} {1}, {2}'.format(dates.substring(0, spaceIndex), dates.substring(dashIndex + 2), thisYear));
                } else {
                    startDate = new Date('{0}, {1}'.format(dates, thisYear));
                    endDate = startDate;
                }
                dancers[i - 1] = new Dancer({ name: name, dates: dates, url: url, photoUrl: photoUrl, fullResolutionPhotoUrl: fullResolutionPhotoUrl, startDate: startDate, endDate: endDate });
            }
            res.write("Finished parsing dancers content\r\n");
            findDancerPromises = dancers.map(function (dancer) {
                return Dancer.findOne({ name: dancer.name, dates: dancer.dates }).exec();
            });
            Promise.settle(findDancerPromises).then(function (findDancerPromiseResults) {
                return createDancers(res, Promise, dancers, Dancer, findDancerPromiseResults);
            }).settle().then(function (createDancersPromiseResults) {
                createDancersPromiseResults.map(function (createDancersPromiseResult, index) {
                    var resultValue,
                        rejectionReason;
                    if (createDancersPromiseResult.isFulfilled()) {
                        resultValue = createDancersPromiseResult.value();
                        if (resultValue.dancerExists === undefined) {
                            res.write("Dancer {0} created\r\n".format(dancers[index].name));
                        }
                    } else {
                        rejectionReason = createDancersPromiseResult.reason();
                        if (rejectionReason.handled === undefined) {
                            res.write("Error while creating dancer {0}: {1}\r\n".format(dancers[index].name), rejectionReason);
                        }
                    }
                });
                res.write("Finished saving dancers event information.\r\n");
                res.end();
            });
        } else {
            if (requestError) {
                return error(res, "Cannot retrieve feature dancers Web page via GET request, got " + requestError);
            }
            return error(res, "Cannot retrieve feature dancers Web page via GET request, got status code: " + response.statusCode);
        }
    });
};