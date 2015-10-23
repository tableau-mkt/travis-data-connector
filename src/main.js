var module = module || {},
    window = window || {},
    jQuery = jQuery || {},
    tableau = tableau || {},
    wdcw = window.wdcw || {};

module.exports = function($, tableau, wdcw) {
  var retriesAttempted = 0,
      maxRetries = 5;

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
    // You may need to perform set up or other initialization tasks at various
    // points in the data connector flow. You can do so here.
    switch (phase) {
      case tableau.phaseEnum.interactivePhase:
        // Perform set up tasks that relate to when the user will be prompted to
        // enter information interactively.
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
      type: 'int'
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

    // Do an initial request to get at the highest build number, then begin to
    // go through all requests in batches of 10.
    getData(buildApiFrom(path, {number: lastRecord}), function initialCall(data) {
      var lastBuild = data[data.length - 1],
          lastBuildNumber = lastBuild ? lastBuild.number : 0,
          hasMore = lastBuildNumber > 1,
          processedData = data;

      if (hasMore) {
        Promise.all(prefetchApiUrls(path, lastBuildNumber)).then(function resolve(values) {
          values.forEach(function (value) {
            processedData = processedData.concat(value);
          });
          registerData(processedData);
        }, function reject(reason) {
          tableau.abortWithError('Unable to fetch data: ' + reason);
          registerData([]);
        });
      }
      else {
        registerData(processedData);
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
    path = opts.number ? path + '?after_number=' + opts.number : path;
    return 'https://api.travis-ci.com/' + path;
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
        urlPromise;

    // Apply defaults.
    itemsPerPage = itemsPerPage || 25;

    // Generate URL batches.
    while (afterNumber > 1) {
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
    $.ajax({
      url: url,
      headers: {
        Accept: 'application/vnd.travis-ci.2+json',
        Authorization: 'token ' + encodeURI(tableau.password),
        'User-Agent': 'TableauTravisWebDataConnector/1.0.0'
      },
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
