var slackAPI = require('slackbotapi');
var _ = require('lodash');
var express = require('express');
var bodyParser = require('body-parser');

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({extended: true}));

app.post('/', function(req, res) {
    console.log(req.body);
    console.log(typeof req.body);

    res.status(200).end();
});

var server = app.listen(process.env.PORT || 5000, function() {
    console.log('Server listening on port ' + server.address().port);
});

// Starting
var slack = new slackAPI({
    'token': process.env.API_TOKEN,
    'logging': true
});

var aliases = [
    {
        channel: 'C04356B87',
        from: '@api',
        to: ['<@U04356B7F>']
    },
    {
        channel: 'C04356B87',
        from: '@test',
        to: ['<@U04356B7F>']
    }
];

slack.on('message', function(data) {
    if(typeof data.text == 'undefined') return;

    if(data.text.indexOf('@') > -1) {
        var mentions = data.text.match(/@[a-z0-9\.-_]*/g),
            replace = [];

        var matching = [];

        _.each(mentions, function(mention) {
            var found = _.where(aliases, {from: mention, channel: data.channel});
            //console.log(found);
            if(found) {
                matching = matching.concat(found);
                replace.push(mention);
            }
        });

        if(!matching.length) {
            return;
        }

        matching = _.chain(matching).pluck('to').flatten().unique().value();

        var message = slack.getUser(data.user).name +
            ' mentioned ' + matching.join(', ') +
            ' and said: \n' +
            data.text;

        _.each(replace, function(text) {
            message = message.replace(text, '').replace('  ', ' ')
        });

        slack.sendMsg(data.channel, message);
    }
});