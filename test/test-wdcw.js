'use strict';

var assert = require('assert'),
    sinon = require('sinon'),
    jQuery = require('../bower_components/jquery/dist/jquery.js')(require('jsdom').jsdom().parentWindow),
    wrapperFactory = require('../src/main.js'),
    tableau = require('./util/tableau.js'),
    connector = require('./util/connector.js'),
    wrapper;

describe('travis-ci-connector:setup', function describesConnectorSetup() {
  var URI;

  beforeEach(function connectorSetupBeforeEach() {
    URI = function() {return {hasQuery: sinon.spy()}};
    wrapper = wrapperFactory;
    wrapper._setUpInteractivePhase = sinon.spy();
  });

  it('calls completion callback during interactive phase', function connectorSetupInteractive(done) {
    // If available, ensure the callback is called during interaction.
    if (wrapper.hasOwnProperty('setup')) {
      wrapper.setup.call(connector, tableau.phaseEnum.interactivePhase)
        .then(done);
    }
    else {
      done();
    }
  });

  it('calls underlying interactive phase setup code', function connectorSetupInteractiveActual(done) {
    wrapper.setup.call(connector, tableau.phaseEnum.interactivePhase)
      .then(function () {
        assert(wrapper._setUpInteractivePhase.called);
        done();
      });
  });

  it('calls completion callback during auth phase', function connectorSetupAuth(done) {
    // If available, ensure the callback is called during authentication.
    if (wrapper.hasOwnProperty('setup')) {
      wrapper.setup.call(connector, tableau.phaseEnum.authPhase)
        .then(done);
    }
    else {
      done();
    }
  });

  it('calls completion callback during data gathering phase', function connectorSetupData(done) {
    // If available, ensure the callback is called during data gathering.
    if (wrapper.hasOwnProperty('setup')) {
      wrapper.setup.call(connector, tableau.phaseEnum.gatherDataPhase)
        .then(done);
    }
    else {
      done();
    }
  });

});

/* @todo write meaningful tests for schema retrieval.
describe('travis-ci-connector:columnHeaders', function describesConnectorColumnHeaders() {

  it('should register expected columns', function connectorColumnHeadersTestHere(done) {
    var expectedColumns = [{
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
    }];

    // Call the schema method.
    wrapper.schema.call(connector)
      .catch(function (schema) {
        done();
      })
    done();
  });

});*/

/* @todo write meaningful tests for data retrieval.
describe('travis-ci-connector:tableData', function describesConnectorTableData() {
  var registerData;

  beforeEach(function connectorTableDataBeforeEach() {
    registerData = sinon.spy();
    sinon.spy(jQuery, 'ajax');
    sinon.spy(jQuery, 'getJSON');
    wdcw = wdcwFactory(jQuery, {}, {});
  });

  afterEach(function connectorTableDataAfterEach() {
    jQuery.ajax.restore();
    jQuery.getJSON.restore();
  });

  // This test is not very meaningful. You should write actual test logic here
  // and/or in new cases below.
  it('should be tested here', function connectorTableDataTestHere() {
    wdcw.tableData.call(connector, registerData);

    assert(registerData.called || jQuery.ajax.called || jQuery.getJSON.called);
    if (registerData.called) {
      assert(Array.isArray(registerData.getCall(0).args[0]));
    }
  });

});*/

describe('travis-ci-connector:teardown', function describesConnectorTearDown() {

  beforeEach(function connectorTearDownBeforeEach() {
    wrapper = wrapperFactory;
  });

  it('calls teardown completion callback', function connectorTearDown(done) {
    // If available, ensure the completion callback is always called.
    if (wrapper.hasOwnProperty('teardown')) {
      wrapper.teardown.call(connector)
        .then(done);
    }
    else {
      done();
    }
  });

});
