'use strict';

String.prototype.format = function () {
  var args = arguments;
  return this.replace(/\{(\d+)\}/g, function (match, number) {
    return args[number] !== undefined ? args[number] : match;
  });
};

var mayordomoApp = angular.module('mayordomoApp', [
  'ngRoute',
  'ui.grid', 'ui.grid.edit', 'ui.grid.rowEdit', 'ui.grid.cellNav', 'ui.grid.resizeColumns', 'ui.grid.pinning', 'ui.grid.moveColumns', 'ui.grid.pagination',
  'ui.bootstrap',
  'mayordomoControllers',
  'mayordomoServices'
]);

mayordomoApp
.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
 }])
.config(['$routeProvider',
  function ($routeProvider) {
    $routeProvider.
      when('/movies', {
        templateUrl: 'partials/movie-list.html',
        controller: 'MovieListCtrl'
      }).
      when('/movies/:movieId', {
        templateUrl: 'partials/movie-detail.html',
        controller: 'MovieDetailCtrl'
      }).
      otherwise({
        redirectTo: '/movies'
      });
  }]);
