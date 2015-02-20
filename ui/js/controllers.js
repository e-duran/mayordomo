'use strict';

var mayordomoControllers = angular.module('mayordomoControllers', []);

mayordomoControllers.controller('MovieListCtrl', ['$scope', 'Movie', 'uiGridConstants', '$modal',
  function ($scope, Movie, uiGridConstants, $modal) {
    var gridRowsToDisplay = 15; // In order to keep grid's auto-height and grid's page size in sync
    $scope.gridOptions = {
      data: 'movies',
      enableColumnResizing: true,
      enableFiltering: true,
      enableGridMenu: false,
      enableCellEditOnFocus: true,
      enableCellEdit: false,
      showGridFooter: false,
      showColumnFooter: false,
      rowEditWaitInterval: 3000,
      minRowsToShow: gridRowsToDisplay,
      paginationPageSizes: [ gridRowsToDisplay ],
      paginationPageSize: gridRowsToDisplay,
      enablePaginationControls: true,
      enableHorizontalScrollbar: uiGridConstants.scrollbars.NEVER,
      enableVerticalScrollbar: uiGridConstants.scrollbars.NEVER
    };

    $scope.gridOptions.rowIdentity = function (row) {
      return row.id;
    };
    $scope.gridOptions.getRowIdentity = function (row) {
      return row.id;
    };

    $scope.gridOptions.columnDefs = [
      { name: 'id', field: '_id', displayName: ' ', width: 24, enableFiltering: false, cellTemplate: '<div class="ui-grid-cell-contents"><span ng-click="grid.appScope.showMovieDetail(grid.getCellValue(row, col))" class="hand glyphicon glyphicon-film" aria-hidden="true" title="View details"></span></div>' },
      { name: 'title', field: 'title', width: 200 },
      { name: 'imdbId', field: 'imdbId', displayName: 'IMDb ID', width: 95, cellTemplate: '<div class="ui-grid-cell-contents">{{ COL_FIELD }} <a href="http://www.imdb.com/title/{{ COL_FIELD }}/" target="_blank" title="View IMDb page"><span class="glyphicon glyphicon-new-window"></span></a></div>' },
      { name: 'rating', field: 'rating', visible: false },
      { name: 'ratingIcon', field: 'ratingIcon', displayName: 'Rating', width: 75, cellTemplate: '<div class="ui-grid-cell-contents text-center"><span class="glyphicon glyphicon-{{grid.getCellValue(row, grid.getColumn(\'ratingIcon\'))}}" title="{{grid.getCellValue(row, grid.getColumn(\'rating\'))}}"></span></div>' },
      { name: 'releasedDate', field: 'releasedDate', displayName: 'Released', width: 100, type: 'Date', cellFilter: "date : 'MMM d' : 'UTC'", filter: { placeholder: 'yyyy-mm' }, cellClass: 'text-center' },
      { name: 'releasedToDvdDate', field: 'releasedToDvdDate', displayName: 'On DVD', width: 90, type: 'Date', cellFilter: "date : 'MMM d' : 'UTC'", filter: { placeholder: 'yyyy-mm' }, cellClass: 'text-center' },
      { name: 'isInteresting', field: 'isInteresting', displayName: 'Interesting', width: 110, enableCellEdit: true, type: 'boolean', cellClass: 'text-center' },
      { name: 'acquired', field: 'acquired', width: 100, enableCellEdit: true, type: 'boolean', cellClass: 'text-center' },
      { name: 'seen', field: 'seen', width: 90, enableCellEdit: true, type: 'boolean', cellClass: 'text-center' }
    ];

    $scope.gridOptions.onRegisterApi = function (gridApi) {
      $scope.gridApi = gridApi;
      gridApi.rowEdit.on.saveRow($scope, function (rowEntity) {
        var promise = Movie.update({ id: rowEntity._id }, rowEntity).$promise;
        $scope.gridApi.rowEdit.setSavePromise(rowEntity, promise);
      });
    };

    $scope.keyedMovies = {};
    $scope.movies = Movie.query(function (movies) {
      movies.forEach(function (movie) {
        var rating = '';
        var ratingIcon = 'hand-left';
        if (movie.imdbRating) {
          rating = 'Metascore: {0}\r\n'.format(movie.metascore || 'N/A');
          rating += 'IMDb: {0} / 10 by {1} users\r\n'.format(movie.imdbRating, movie.imdbVotes.toLocaleString());
        }
        if (movie.tomatoMeter && movie.tomatoReviews && movie.tomatoRating) {
          rating += '{0}% of {1} Rotten Tomatoes critics gave it a positive review ({2} fresh, {3} rotten) with an average rating of {4} / 10\r\n'.format(movie.tomatoMeter, movie.tomatoReviews.toLocaleString(), movie.tomatoFresh, movie.tomatoRotten, movie.tomatoRating);
        }
        if (movie.tomatoUserMeter && movie.tomatoUserReviews && movie.tomatoUserRating) {
          rating += '{0}% of {1} Rotten Tomatoes users liked it and gave it an average rating of {2} / 5\r\n'.format(movie.tomatoUserMeter, movie.tomatoUserReviews.toLocaleString(), movie.tomatoUserRating);
        }
        if (movie.imdbRating && movie.metascore && movie.tomatoRating && movie.tomatoUserRating && movie.imdbRating >= 7 && movie.metascore >= 70 && movie.tomatoRating >= 7 && movie.tomatoUserRating >= 3.5) {
          ratingIcon = 'star';
        } else if (movie.imdbRating) {
          if (movie.imdbRating >= 7) {
            ratingIcon = 'thumbs-up';
          } else {
            ratingIcon = 'thumbs-down';
          }
        }
        movie.rating = rating || 'N/A';
        movie.ratingIcon = ratingIcon;

        $scope.keyedMovies[movie._id] = movie;
      });
    });

    $scope.showMovieDetail = function (id) {
      $scope.movie = $scope.keyedMovies[id];
      $modal.open({
        templateUrl: 'partials/movie-detail-modal.html',
        backdrop: true,
        windowClass: 'modal',
        controller: function ($scope, $modalInstance, movie) {
          $scope.movie = movie;
          $scope.showMovieImdbId = false;
          $scope.closeMovieDetailsModal = function () {
            $modalInstance.close();
          };
        },
        resolve: {
          movie: function () {
            return $scope.movie;
          }
        }
      });
    };
}]);