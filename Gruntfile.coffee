module.exports = (grunt) ->
  grunt.initConfig {
    pkg : grunt.file.readJSON('package.json')
    watch:
      coffee : 
        files:["src/*.coffee","src/*/*.coffee"]
        tasks:["coffee"]
    coffee : 
      server :
          expand:true
          cwd:"./src/"
          src:["*/*.coffee","*.coffee"]
          dest:"./"
          ext:".js"
  }

  grunt.loadNpmTasks('grunt-contrib-watch')
  grunt.loadNpmTasks('grunt-contrib-coffee')
  grunt.registerTask('default', ['coffee'])