const proxy = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(proxy('/events', {target: 'http://localhost:3001'}));
  app.use(proxy('/config', {target: 'http://localhost:3001'}));
};