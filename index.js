var util = require('util'),
   redis = require("redis"),
  client = redis.createClient(),
     app = require('express')(),
    http = require('http').Server(app),
      io = require('socket.io')(http),
  config = require('./config');

var twitter = new (require('twitter-streamer'))(config.twitter);

var stream = new twitter.Stream(config.stream);

client.on("error", function (err) {
  console.log("Redis Error " + err);
});

var reconnectSentinel = true;

function cleanup() {
  reconnectSentinel = false;
  stream.disconnect();
  client.quit();
  process.exit();
}

process.on('SIGABRT', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGQUIT', cleanup);
process.on('SIGHUP', cleanup);
process.on('SIGTERM', cleanup);

stream.on('tweet', function(tweet) {
  // Ignore RT's and potentially scandalous content
  if(tweet["possibly_sensitive"] || tweet["retweeted"]) { return; }
  io.emit('tweet', tweet);
  client.rpush("confurrent:nejsconf", JSON.stringify(tweet));
});

stream.on('disconnect', function(reason) {
  if(reconnectSentinel && reason == 'abort') {
    stream.connect();
  }
});

stream.connect();

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/recent.json', function (req, res) {
  client.lrange("confurrent:nejsconf", -11, -1, function (error, tweets) {
    res.json({tweets: tweets});
  });
});

http.listen(config.server.port, function(){
  console.log('listening on *:' + config.server.port);
});
