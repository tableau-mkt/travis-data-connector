// Generated on 2015-10-22 using generator-web-data-connector 1.0.0

'use strict';

module.exports = function(grunt) {

  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        'Gruntfile.js',
        'js/*.js',
        '!js/scripts.min.js'
      ]
    },
    concat: {
      js: {
        options: {
          separator: ';'
        },
        src: [
          'bower_components/es6-promise/promise.js',
          'bower_components/jquery/dist/jquery.js',
          'bower_components/tableau/dist/*.js',
          'bower_components/bootstrap/dist/js/bootstrap.js',
          'src/wrapper.js',
          'src/**/*.js'
        ],
        dest: 'build/all.js'
      }
    },
    uglify: {
      options: {
        compress: true,
        mangle: true,
        sourceMap: true
      },
      target: {
        src: 'build/all.js',
        dest: 'build/all.min.js'
      }
    },
    express: {
      server: {
        options: {
          script: 'index.js',
          port: 9001
        }
      }
    },
    watch: {
      scripts: {
        files: 'src/**/*.js',
        tasks: [
          'jshint',
          'concat',
          'uglify'
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-express-server');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', [
    'build',
    'run'
  ]);

  grunt.registerTask('run', [
    'express:server',
    'watch'
  ]);

  grunt.registerTask('build', [
    'jshint',
    'concat',
    'uglify'
  ]);
};
