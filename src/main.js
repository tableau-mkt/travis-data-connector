var module = module || {},
    window = window || {},
    jQuery = jQuery || {},
    tableau = tableau || {},
    wdcw = window.wdcw || {};

module.exports = function($, tableau, wdcw) {
  var retriesAttempted = 0,
      maxRetries = 5,
      untilBuild = 0,
      defaultItemsPerPage = 25,
      connector;

  /**
   * Run during initialization of the web data connector.
   *
   * @param {string} phase
   *   The initialization phase. This can be one of:
   *   - tableau.phaseEnum.interactivePhase: Indicates when the connector is
   *     being initialized with a user interface suitable for an end-user to
   *     enter connection configuration details.
   *   - tableau.phaseEnum.gatherDataPhase: Indicates when the connector is
   *     being initialized in the background for the sole purpose of collecting
   *     data.
   *   - tableau.phaseEnum.authPhase: Indicates when the connector is being
   *     accessed in a stripped down context for the sole purpose of refreshing
   *     an OAuth authentication token.
   * @param {function} setUpComplete
   *   A callback function that you must call when all setup tasks have been
   *   performed.
   */
  wdcw.setup = function setup(phase, setUpComplete) {
    connector = this;

    // You may need to perform set up or other initialization tasks at various
    // points in the data connector flow. You can do so here.
    switch (phase) {
      case tableau.phaseEnum.interactivePhase:
        // Set the build number as the incremental extract column.
        connector.setIncrementalExtractColumn('number');

        // Perform actual interactive phase stuff.
        wdcw._setUpInteractivePhase();
        break;

      case tableau.phaseEnum.gatherDataPhase:
        // Perform set up tasks that should happen when Tableau is attempting to
        // retrieve data from your connector (the user is not prompted for any
        // information in this phase.
        break;

      case tableau.phaseEnum.authPhase:
        // Perform set up tasks that should happen when Tableau is attempting to
        // refresh OAuth authentication tokens.
        break;
    }

    // Always register when initialization tasks are complete by calling this.
    // This can be especially useful when initialization tasks are asynchronous
    // in nature.
    setUpComplete();
  };

  /**
   * Actual interactive phase setup code. Mostly separated for testability, but
   * tests still TBD...
   */
  wdcw._setUpInteractivePhase = function setUpInteractivePhase() {
    var $modal = $('div.modal'),
        $form = $('form'),
        recoverFromError = function recoverFromError() {
          $modal.find('h3').text('There was a problem authenticating.');
          setTimeout(function () {
            $modal.modal('hide');
          }, 2000);
        },
        params,
        uri;

    // Listen for oauth flow indicators from GitHub.
    uri = new URI(window.location.href);
    if (uri.hasQuery('code') && uri.hasQuery('state')) {
      params = uri.search(true);

      // Pop a modal indicating that we're attempting to authenticate.
      $modal.modal('show');

      // Validate the provided state.
      $.ajax({
        url: '/validate_state?state=' + params.state,
        success: function stateValidated() {
          // Attempt to negotiate with GitHub to pull a Travis CI auth token.
          $.ajax({
            url: '/travis_token?isPrivate=yes&code=' + params.code,
            type: 'POST',
            success: function dataRetrieved(response) {
              // Set the connection password to the returned token value.
              connector.setPassword(response.access_token);
              $('#password').val(response.access_token).change();

              // Push a window history change so Tableau remembers the bare URL
              // as the connection location, not the one that includes a "code"
              // param as returned by GitHub during initial authentication.
              window.history.pushState({}, '', uri.protocol() + '://' + uri.authority());

              // Hide the "attempting auth" modal; trigger connection start.
              $modal.modal('hide');
              $('form').submit();
            },
            error: recoverFromError
          });
        },
        error: recoverFromError
      });
    }

    // Add a handler to detect the need for and initiate oauth flow.
    $form.submit(function (event) {
      // If connection is attempted for a private repo and we have no token
      // on hand, then we need to initiate our oauth flow to get it.
      if ($('#IsPrivate').is(':checked') && !connector.getPassword()) {
        // Prevent the WDCW handler from firing.
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Save off all existing connection details so that they persist
        // after GitHub redirects back post-authentication.
        connector.setConnectionData({
          IsPrivate: true,
          RepoSlug: $('#RepoSlug').val(),
          Limit: $('#Limit').val()
        });

        // Send the user to the GitHub authentication page (for oauth).
        window.location = '/authorize';
      }
    });

    // Reverse submit bindings on the $form element so our handler above is
    // triggered before the main WDCW handler, allowing us to prevent it.
    $._data($form[0], 'events').submit.reverse();
  };

  /**
   * Run when the web data connector is being unloaded. Useful if you need
   * custom logic to clean up resources or perform other shutdown tasks.
   *
   * @param {function} tearDownComplete
   *   A callback function that you must call when all shutdown tasks have been
   *   performed.
   */
  wdcw.teardown = function teardown(tearDownComplete) {
    // Once shutdown tasks are complete, call this. Particularly useful if your
    // clean-up tasks are asynchronous in nature.
    tearDownComplete();
  };

  /**
   * Primary method called when Tableau is asking for the column headers that
   * this web data connector provides. Takes a single callable argument that you
   * should call with the headers you've retrieved.
   *
   * @param {function(Array<{name, type, incrementalRefresh}>)} registerHeaders
   *   A callback function that takes an array of objects as its sole argument.
   *   For example, you might call the callback in the following way:
   *   registerHeaders([
   *     {name: 'Boolean Column', type: 'bool'},
   *     {name: 'Date Column', type: 'date'},
   *     {name: 'DateTime Column', type: 'datetime'},
   *     {name: 'Float Column', type: 'float'},
   *     {name: 'Integer Column', type: 'int'},
   *     {name: 'String Column', type: 'string'}
   *   ]);
   *
   *   Note: to enable support for incremental extract refreshing, add a third
   *   key (incrementalRefresh) to the header object. Candidate columns for
   *   incremental refreshes must be of type datetime or integer. During an
   *   incremental refresh attempt, the most recent value for the given column
   *   will be passed as "lastRecord" to the tableData method. For example:
   *   registerHeaders([
   *     {name: 'DateTime Column', type: 'datetime', incrementalRefresh: true}
   *   ]);
   */
  wdcw.columnHeaders = function columnHeaders(registerHeaders) {
    // @todo Add Config data, Job IDs.
    registerHeaders([{
      name: 'id',
      type: 'int'
    }, {
      name: 'repository_id',
      type: 'int'
    }, {
      name: 'commit_id',
      type: 'int'
    }, {
      name: 'number',
      type: 'int',
      incrementalRefresh: true
    }, {
      name: 'pull_request',
      type: 'bool'
    }, {
      name: 'pull_request_title',
      type: 'string'
    }, {
      name: 'pull_request_number',
      type: 'int'
    }, {
      name: 'state',
      type: 'string'
    }, {
      name: 'started_at',
      type: 'datetime'
    }, {
      name: 'finished_at',
      type: 'datetime'
    }, {
      name: 'duration',
      type: 'int'
    }]);
  };


  /**
   * Primary method called when Tableau is asking for your web data connector's
   * data. Takes a callable argument that you should call with all of the
   * data you've retrieved. You may optionally pass a token as a second argument
   * to support paged/chunked data retrieval.
   *
   * @param {function(Array<{object}>, {string})} registerData
   *   A callback function that takes an array of objects as its sole argument.
   *   Each object should be a simple key/value map of column name to column
   *   value. For example, you might call the callback in the following way:
   *   registerData([
   *     {'String Column': 'String Column Value', 'Integer Column': 123}
   *   ]});
   *
   *   It's possible that the API you're interacting with supports some mechanism
   *   for paging or filtering. To simplify the process of making several paged
   *   calls to your API, you may optionally pass a second argument in your call
   *   to the registerData callback. This argument should be a string token that
   *   represents the last record you retrieved.
   *
   *   If provided, your implementation of the tableData method will be called
   *   again, this time with the token you provide here. Once all data has been
   *   retrieved, pass null, false, 0, or an empty string.
   *
   * @param {string} lastRecord
   *   Optional. If you indicate in the call to registerData that more data is
   *   available (by passing a token representing the last record retrieved),
   *   then the lastRecord argument will be populated with the token that you
   *   provided. Use this to update/modify the API call you make to handle
   *   pagination or filtering.
   *
   *   If you indicated a column in wdcw.columnHeaders suitable for use during
   *   an incremental extract refresh, the last value of the given column will
   *   be passed as the value of lastRecord when an incremental refresh is
   *   triggered.
   */
  wdcw.tableData = function tableData(registerData, lastRecord) {
    var repoSlug = this.getConnectionData()['RepoSlug'],
        path = 'repos/' + repoSlug + '/builds';

    // If a value is passed in for lastRecord, stash it. It means that Tableau
    // is attempting an incremental refresh. We'll use the stashed value as a
    // bound for API requests.
    if (lastRecord) {
      untilBuild = Number(lastRecord);
    }

    // Do an initial request to get at the highest build number, then begin to
    // go through all requests.
    getData(buildApiFrom(path, {}), function initialCall(data) {
      var lastBuild = data[data.length - 1],
          lastBuildNumber = lastBuild ? Number(lastBuild.number) : 0,
          hasMore = lastBuildNumber > 1,
          isRefreshAndStillHasMore = lastBuildNumber > untilBuild,
          untilBuildIsInThisPayload = untilBuild >= lastBuildNumber && untilBuild <= lastBuildNumber + defaultItemsPerPage - 1,
          processedData = data,
          row;

      // The most common case: there's more data to be collected, so we figure
      // out the URLs to fetch and fetch them.
      if (hasMore && isRefreshAndStillHasMore) {
        Promise.all(prefetchApiUrls(path, lastBuildNumber)).then(function resolve(values) {
          values.forEach(function (value) {
            processedData = processedData.concat(value);
          });
          // Reverse the processed data so Tableau will send the correct record
          // number during incremental extract refreshes.
          registerData(processedData.reverse());
        }, function reject(reason) {
          tableau.abortWithError('Unable to fetch data: ' + reason);
          registerData([]);
        });
      }
      // Less common case: the token Tableau passed in for incremental refresh
      // is within the initial API request payload. Only append data that isn't
      // already within the extract.
      else if (untilBuild && untilBuildIsInThisPayload) {
        processedData = [];
        while (data.length) {
          row = data.pop();
          if (row.number && Number(row.number) > untilBuild) {
            processedData.push(row);
          }
        }
        // Note we don't need to reverse this array because we processed the API
        // payload from the end back (via Array.pop).
        registerData(processedData);
      }
      // Least common case: the initial API request returned all records. Just
      // return them.
      else {
        // Note: we reverse the response so Tableau uses the expected value when
        // attempting incremental extract refreshes.
        registerData(processedData.reverse());
      }
    });
  };

  // You can write private methods for use above like this:

  /**
   * Helper function to build an API endpoint.
   *
   * @param {string} path
   *   API endpoint path from which to build a full URL.
   *
   * @param {object} opts
   *   Options to inform query parameters and paging.
   */
  function buildApiFrom(path, opts) {
    var isPrivate = connector.getConnectionData()['IsPrivate'],
        root = isPrivate ? 'https://api.travis-ci.com' : 'https://api.travis-ci.org';

    path = opts.number ? path + '?after_number=' + opts.number : path;
    return root + '/' + path;
  }

  /**
   * Helper function to return am array of promises
   *
   * @param {string} path
   *   The Travis API path to hit (e.g. /repo/{slug}/builds)
   * @param {int} afterNumber
   *   The last known build to pull.
   * @param {int} itemsPerPage
   *   The number of items the API returns per page. Defaults to 25.
   *
   * @returns {[]}
   *   An array of promise objects, set to resolve or reject after attempting to
   *   retrieve API data.
   */
  function prefetchApiUrls(path, afterNumber, itemsPerPage) {
    var urlPromises = [],
        rowLimit = connector.getConnectionData()['Limit'] || 2500,
        maxPromises,
        urlPromise;

    // Apply defaults, calculate max promises to return.
    itemsPerPage = itemsPerPage || defaultItemsPerPage;
    maxPromises = (rowLimit - itemsPerPage) / itemsPerPage;

    // Account for incremental extract refresh attempts.
    if (untilBuild) {
      maxPromises = Math.floor(maxPromises, (afterNumber - untilBuild) / itemsPerPage);
    }

    // Generate URL batches.
    while (afterNumber > 1 && urlPromises.length < maxPromises) {
      urlPromise = new Promise(function urlPromise(resolve, reject) {
        getData(buildApiFrom(path, {number: afterNumber}), function gotData(data) {
          resolve(data);
        }, function couldNotGetData(reason) {
          reject(reason);
        });
      });

      urlPromises.push(urlPromise);
      afterNumber -= itemsPerPage;
    }

    return urlPromises;
  }

  /**
   * AJAX call to our API.
   *
   * @param {string} url
   *   The url used for our API call.
   * @param {function(data)} successCallback
   *   A callback function which takes one argument:
   *     data: result set from the API call.
   * @param {function(reason)} failCallback
   *   A callback which takes one argument:
   *     reason: A string describing why data collection failed.
   */
  function getData(url, successCallback, failCallback) {
    var isPrivate = connector.getConnectionData()['IsPrivate'],
        requestHeaders = {
          Accept: 'application/vnd.travis-ci.2+json',
          'User-Agent': 'TableauTravisWebDataConnector/1.0.0'
        };

    if (isPrivate) {
      requestHeaders.Authorization = 'token ' + encodeURI(connector.getPassword());
    }

    $.ajax({
      url: url,
      headers: requestHeaders,
      success: function dataRetrieved(response) {
        successCallback(response.builds);
      },
      error: function retrievalFailed(xhr, status, error) {
        if (retriesAttempted <= maxRetries) {
          retriesAttempted++;
          getData(url, successCallback, failCallback);
        }
        else {
          failCallback('JSON fetch failed too many times for ' + url + '.');
        }
      }
    });
  }

  return wdcw;
};

// Set the global wdcw variable as expected.
wdcw = module.exports(jQuery, tableau, wdcw);
