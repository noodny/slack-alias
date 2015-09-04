var slackAPI = require('slackbotapi');
var _ = require('lodash');
var express = require('express');
var bodyParser = require('body-parser');

// Starting
var slack = new slackAPI({
    'token': process.env.SLACK_BOT_TOKEN,
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
            if(found && found.length) {
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

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', function(req, res) {
    console.log(req.originalUrl);
    if(req.query.token === process.env.SLACK_SLASH_TOKEN) {
        var text = req.query.text;

        if(text.indexOf('list') === 0) {
            var matches = _.where(aliases, {channel: req.query.channel_id});

            if(matches && matches.length) {
                var message = 'These are the aliases set up for this channel:\n';
                _.each(matches, function(match){
                    message += match.from + ' -> ' + match.to.join(', ') + '\n'
                });
                res.send(message);
            } else {
                res.send('There are no aliases set up for this channel.');
            }
        }

        if(text.indexOf('add') === 0) {
            // get a list of users in the channel


            // send a message to the channel when successful
            console.log(text);
        }

        if(text.indexOf('remove') === 0) {

            // send a message to the channel when successful
        }
    }

    res.status(200).end();
});

var server = app.listen(process.env.PORT || 5000, function() {
    console.log('Server listening on port ' + server.address().port);
});