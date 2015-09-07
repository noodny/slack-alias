var slackAPI = require('slackbotapi');
var _ = require('lodash');
var express = require('express');
var bodyParser = require('body-parser');
var pmx = require('pmx');

pmx.init();

if(!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SLASH_TOKEN) {
    throw new Error('Slack tokens not set as environment variables. Exiting...');
    process.exit(0);
}

// Starting
var slack = new slackAPI({
    'token': process.env.SLACK_BOT_TOKEN,
    'logging': true
});

var aliases = [
    {
        channel: 'C04356B87',
        from: '@api',
        to: ['<@U04356B7F>'],
        author: 'U04356B7F'
    },
    {
        channel: 'C04356B87',
        from: '@test',
        to: ['<@U04356B7F>'],
        author: 'U04356B7A'
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

        pmx.emit('alias:match', {
            aliases: matching
        });

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
    if(req.query.token === process.env.SLACK_SLASH_TOKEN) {
        var text = req.query.text;

        if(text.indexOf('list') === 0) {
            var matches = _.where(aliases, {channel: req.query.channel_id});

            pmx.emit('alias:list', {
                channel: req.query.channel_id
            });

            if(matches && matches.length) {
                var message = 'These are the aliases set up for this channel:\n';
                _.each(matches, function(match) {
                    message += match.from + ' -> @' + _.map(match.to, function(user){
                            return slack.getUser(user.replace('<@', '').replace('>', '')).name
                        }).join(', ') + '\n'
                });
                res.send(message);
            } else {
                res.send('There are no aliases set up for this channel.');
            }
        }

        if(text.indexOf('add') === 0) {
            var split = text.split(' ');

            if(split.length < 3) {
                return res.status(400).send('Not enough parameters').end();
            }

            var from = split[1];
            var existing = _.findWhere(aliases, {from: from, channel: req.query.channel_id});

            if(existing && existing.author !== req.query.user_id) {
                return res.status(400).send('You cannot edit an alias made by someone else').end();
            }

            var to = split.splice(2, split.length - 2);

            var error = false;

            to = _.map(to, function(username) {
                var user = slack.getUser(username.replace('@', ''));
                if(!user) {
                    error = 'User ' + username.replace('@', '') + ' does not exist!';
                    return username;
                } else {
                    return '<@' + user.id + '>'
                }
            });

            if(error) {
                return res.status(400).send(error).end();
            }

            if(existing) {
                aliases = _.reject(aliases, existing);

                pmx.emit('alias:update', {
                    channel: req.query.channel_id
                });
            } else {
                pmx.emit('alias:create', {
                    channel: req.query.channel_id
                });
            }

            aliases.push({
                channel: req.query.channel_id,
                from: from,
                to: to,
                author: req.query.user_id
            });

            slack.sendMsg(req.query.channel_id, 'User ' + slack.getUser(req.query.user_id).name + ' updated an alias: \n ' + from + ' -> @' + _.map(to, function(user){
                    return slack.getUser(user.replace('<@', '').replace('>', '')).name
                }).join(', '));
            return res.status(200).send(existing ? 'Alias updated' : 'Alias created').end();
        }

        if(text.indexOf('remove') === 0) {
            var split = text.split(' ');

            if(split.length < 2) {
                return res.status(400).send('Not enough parameters').end();
            }

            var from = split[1];
            var existing = _.findWhere(aliases, {from: from, channel: req.query.channel_id});

            if(!existing) {
                return res.status(400).send('Alias ' + from + ' does not exist. Use `/alias list` to see all existing aliases. ')
            }

            if(existing.author !== req.query.user_id) {
                return res.status(400).send('You cannot remove an alias made by someone else').end();
            }

            pmx.emit('alias:remove', {
                channel: req.query.channel_id
            });

            aliases = _.reject(aliases, existing);

            slack.sendMsg(req.query.channel_id, 'User ' + slack.getUser(req.query.user_id).name + ' removed alias ' + from);

            return res.status(200).send('Alias removed').end();
        }
    }

    res.status(200).end();
});

var server = app.listen(process.env.PORT || 5000, function() {
    console.log('Server listening on port ' + server.address().port);
});