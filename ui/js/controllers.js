'use strict';

var mayordomoControllers = angular.module('mayordomoControllers', []);

function convertRating (rating) {
  switch (rating) {
    case 'thumbs-down':
      return 0;
    case 'hand-left':
      return 10;
    case 'thumbs-up':
      return 20;
    case 'star':
      return 30;
    default:
      return -1;
  }
}

var ratingSortFuntion = function (a, b) {
  a = convertRating(a);
  b = convertRating(b);
  if (a == b) return 0;
  if (a < b) return -1;
  return 1;
};

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
      minRowsToShow: gridRowsToDisplay + 1,
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
      { name: 'id', field: '_id', displayName: ' ', width: 24, enableSorting: false, enableColumnMenu: false, enableFiltering: false, cellTemplate: '<div class="ui-grid-cell-contents"><span ng-click="grid.appScope.showMovieDetail(grid.getCellValue(row, col))" class="hand glyphicon glyphicon-film" aria-hidden="true" title="View details"></span></div>' },
      { name: 'title', field: 'title', width: 200 },
      { name: 'imdbId', field: 'imdbId', displayName: 'IMDb ID', width: 100, cellTemplate: '<div class="ui-grid-cell-contents">{{ COL_FIELD }} <a ng-if="grid.getCellValue(row, col)" href="http://www.imdb.com/title/{{ COL_FIELD }}/" target="_blank" title="View IMDb page"><span class="glyphicon glyphicon-new-window"></span></a></div>' },
      { name: 'rating', field: 'rating', visible: false },
      { name: 'ratingIcon', field: 'ratingIcon', displayName: 'Rating', width: 90, sortingAlgorithm: ratingSortFuntion, cellTemplate: '<div class="ui-grid-cell-contents text-center"><span class="glyphicon glyphicon-{{grid.getCellValue(row, grid.getColumn(\'ratingIcon\'))}}" title="{{grid.getCellValue(row, grid.getColumn(\'rating\'))}}"></span></div>' },
      { name: 'releasedDate', field: 'releasedDate', displayName: 'Released', width: 110, cellFilter: "date : 'MMM d' : 'UTC'", filter: { placeholder: 'yyyy-mm' }, cellClass: 'text-center' },
      { name: 'releasedToDvdDate', field: 'releasedToDvdDate', displayName: 'On DVD', width: 100, cellFilter: "date : 'MMM d' : 'UTC'", filter: { placeholder: 'yyyy-mm' }, cellClass: 'text-center' },
      { name: 'isInteresting', field: 'isInteresting', displayName: 'Interesting', width: 120, enableCellEdit: true, type: 'boolean', cellClass: 'text-center' },
      { name: 'acquired', field: 'acquired', width: 110, enableCellEdit: true, type: 'boolean', cellClass: 'text-center' },
      { name: 'seen', field: 'seen', width: 105, enableCellEdit: true, type: 'boolean', cellClass: 'text-center' }
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
        var ratings = [];
        var ratingIcon = 0;
        if (movie.comboScore) {
          ratings.push(`Combo score: ${movie.comboScore}`);
        }
        if (movie.metascore) {
          ratings.push(`Metascore: ${movie.metascore}`);
        }
        if (movie.imdbRating && movie.imdbVotes) {
          ratings.push('IMDb: {0} / 10 by {1} users'.format(movie.imdbRating, movie.imdbVotes.toLocaleString()));
        }
        if (movie.tomatoMeter && movie.tomatoReviews && movie.tomatoRating) {
          ratings.push('{0}% of {1} Rotten Tomatoes critics gave it a positive review ({2} fresh, {3} rotten) with an average rating of {4} / 10'.format(movie.tomatoMeter, movie.tomatoReviews.toLocaleString(), movie.tomatoFresh, movie.tomatoRotten, movie.tomatoRating));
        } else if (movie.tomatoMeter && movie.tomatoReviews) {
          ratings.push('{0}% of {1} Rotten Tomatoes critics gave it a positive review'.format(movie.tomatoMeter, movie.tomatoReviews.toLocaleString()));
        }
        if (movie.tomatoUserMeter && movie.tomatoUserReviews && movie.tomatoUserRating) {
          ratings.push('{0}% of {1} Rotten Tomatoes users liked it and gave it an average rating of {2} / 5'.format(movie.tomatoUserMeter, movie.tomatoUserReviews.toLocaleString(), movie.tomatoUserRating));
        } else if (movie.tomatoUserMeter && movie.tomatoUserReviews) {
          ratings.push('{0}% of {1} Rotten Tomatoes users liked it'.format(movie.tomatoUserMeter, movie.tomatoUserReviews.toLocaleString()));
        }
        if (movie.letterboxdScore) {
          ratings.push(`Letterboxd score: ${movie.letterboxdScore} by ${movie.letterboxdVotes.toLocaleString()} ratings`);
        }
        
        if (movie.comboScore) {
          ratingIcon = movie.comboScore > 70 ? (movie.comboScore > 84 ? 5 : 1) : -1;
        } else {
          if (movie.metascore) { ratingIcon += movie.metascore > 70 ? 1 : -1 }
          if (movie.imdbRating) { ratingIcon += movie.imdbRating > 7 ? 1 : -1 }
          if (movie.letterboxdScore) { ratingIcon += movie.letterboxdScore > 70 ? 1 : -1 }
          if (movie.tomatoRating) {
            ratingIcon += movie.tomatoRating >=7 ? 1 : -1;
          } else if (movie.tomatoMeter) {
            ratingIcon += movie.tomatoMeter >=80 ? 1 : -1;
          }
          if (movie.tomatoUserRating) {
            ratingIcon += movie.tomatoUserRating >=3.5 ? 1 : -1;
          } else if (movie.tomatoUserMeter) {
            ratingIcon += movie.tomatoUserMeter >=80 ? 1 : -1;
          }
        }
        movie.rating = ratings.join('\r\n') || 'N/A';
        movie.ratingIcon = ratingIcon === 0 ? 'hand-left' : (ratingIcon > 0 ? (ratingIcon > 4 ? 'star' : 'thumbs-up') : 'thumbs-down');
        movie.webSite = movie.webSite === 'N/A' ? null : movie.webSite;

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