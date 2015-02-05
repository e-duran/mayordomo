"use strict";

var models = require('../models');
var request = require('request');
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var sharedRes;

function error(res, message) {
    res.status(500).write(message);
    res.end();
}

function saveDancer(currentDancer, index, array) {
    models.Dancer
        .findOrCreate({ where: { name: currentDancer.name, dates: currentDancer.dates }, 
                        defaults: { url: currentDancer.url, photoUrl: currentDancer.photoUrl, fullResolutionPhotoUrl: currentDancer.fullResolutionPhotoUrl, startDate: currentDancer.startDate, endDate: currentDancer.endDate }
                      })
        .spread(function(dancer, created) {
        if (created) {
            sharedRes.write('Created dancer {0}\r\n'.format(dancer.name));
        }
        else {
            sharedRes.write('Dancer {0} already exists\r\n'.format(dancer.name));
        }
        if (index + 1 == array.length) {
            sharedRes.end();
        }
    });
}

exports.execute = function(req, res) {
    sharedRes = res;
    res.type('text');
    
    request('http://www.blushexotic.com/girls/feature-dancers/', function(requestError, response, body) {
        if (!requestError && response.statusCode == 200) {
            res.write("Retrieved feature dancers Web page via GET request\r\n");
            var startContentIndex = body.indexOf('<div id="full-width" class="content">');
            var endContentIndex = body.indexOf('<!-- end main content holder (#content/#full-width) -->', startContentIndex);
            if (startContentIndex < 0 || endContentIndex < 0) return error(res, "Cannot find dancers content");
            var content = body.substring(startContentIndex, endContentIndex);
            content = content.replace(/&nbsp;/g, '');
            res.write("Content for parsing:\r\n" + content + "\r\n");
            
            var doc = new dom().parseFromString(content);
            var nodes = xpath.select("/div/div/div/div/div", doc);
            if (nodes == null || (!nodes && nodes.length == 0)) return error(res, "Cannot find individual dancers content");
            var dancers = [];
            for (var i = 1; i < nodes.length; i++) {
                var classNode = xpath.select1("/div/div/div/div/div[" + i + "]/@class", doc);
                if (classNode != null && (classNode.value.indexOf('services-no-content') > -1 || classNode.value.indexOf('clear') > -1)) {
                    continue;
                }
                
                var nameNode = xpath.select1("/div/div/div/div/div[" + i + "]/a/div/img/@alt", doc);
                var name = nameNode == null ? null : nameNode.value;
                var datesNode = xpath.select("/div/div/div/div/div[" + i + "]/div/div/p/text()", doc);
                var dates = datesNode == null ? null : datesNode.toString();
                var urlNode = xpath.select1("/div/div/div/div/div[" + i + "]/a/@href", doc);
                var url = urlNode == null ? null : 'http://www.blushexotic.com' + urlNode.value;
                var photoUrlNode = xpath.select1("/div/div/div/div/div[" + i + "]/a/div/img/@src", doc);
                var photoUrl = photoUrlNode == null ? null : photoUrlNode.value;
                var fullResolutionPhotoUrl = null;
                
                if (name == null) return error(res, "Cannot find name for dancer");
                if (dates == null) return error(res, "Cannot find dates for dancer");
                if (url == null) return error(res, "Cannot find URL for dancer");
                if (photoUrl == null) return error(res, "Cannot find photo URL for dancer");
                var dashIndex = photoUrl.lastIndexOf('-');
                if (dashIndex > 0) {
                    fullResolutionPhotoUrl = photoUrl.substring(0, dashIndex) + '.jpg';
                }
                
                var startDate, endDate;
                dashIndex = dates.indexOf('-');
                if (dashIndex > 0) {
                    startDate = new Date('{0}, {1}'.format(dates.substring(0, dashIndex), new Date().getFullYear()));
                    var spaceIndex = dates.indexOf(' ');
                    endDate = new Date('{0} {1}, {2}'.format(dates.substring(0, spaceIndex), dates.substring(dashIndex + 2), new Date().getFullYear()));
                }
                else {
                    startDate = new Date('{0}, {1}'.format(dates, new Date().getFullYear()));
                    endDate = startDate;
                }
                
                var dancer = models.Dancer.build({
                  name: name, dates: dates, url: url, photoUrl: photoUrl, fullResolutionPhotoUrl: fullResolutionPhotoUrl, startDate: startDate, endDate: endDate
                });
                dancers[i - 1] = dancer;
            }
            res.write("Finished parsing dancers content\r\n");
            dancers.forEach(saveDancer);
        }
        else {
            error(res, "Cannot retrieve feature dancers Web page via GET request, got error: " + requestError);
        }
    });
};