
import http from 'http'
import app from './server'


console.log('INITIALIZING');

const server = http.createServer(app)
let currentApp = app
server.listen(3001)

if (module.hot) {
 module.hot.accept('./server', () => {
  server.removeListener('request', currentApp)
  server.on('request', app)
  currentApp = app
 })
}
