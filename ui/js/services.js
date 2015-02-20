'use strict';

var mayordomoServices = angular.module('mayordomoServices', ['ngResource']);

mayordomoServices.factory('Movie', ['$resource', function ($resource) {
  return $resource('../api/movies/:id', { id: '@_id' }, {
    update: { method: 'PUT' },
  });
}]);
