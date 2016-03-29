/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack Button application that adds a bot to one or many slack teams.

# RUN THE APP:
  Create a Slack app. Make sure to configure the bot user!
    -> https://api.slack.com/applications/new
    -> Add the Redirect URI: http://localhost:3000/oauth
  Run your bot from the command line:
    clientId=<my client id> clientSecret=<my client secret> port=3000 node slackbutton_bot.js
# USE THE APP
  Add the app to your Slack by visiting the login page:
    -> http://localhost:3000/login
  After you've added the app, try talking to your bot!
# EXTEND THE APP:
  Botkit is has many features for building cool and useful bots!
  Read all about it here:
    -> http://howdy.ai/botkit
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

/* Uses the slack button feature to offer a real time bot to multiple teams */
var Botkit = require('botkit');
var Redis_Store = require('./redis_storage.js');
var redis_url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
var redis_store = new Redis_Store({url: redis_url});

require('./env.js');

if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}


var controller = Botkit.slackbot({
  //json_file_store: './db_slackbutton_bot/',
  storage: redis_store,
}).configureSlackApp(
  {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    scopes: ['bot'],
  }
);

controller.setupWebserver(process.env.port,function(err,webserver) {

  webserver.get('/', function(req, res){
    res.sendFile('index.html', {root:__dirname})
  });

  controller.createWebhookEndpoints(controller.webserver);

  controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      res.send('Success!');
    }
  });
});


//set up various lists that we're gonna use today


// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {};
function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

controller.on('create_bot',function(bot,config) {

  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function(err) {

      if (!err) {
        trackBot(bot);
      }

      bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
        if (err) {
          console.log(err);
        } else {
          convo.say('I am a bot that has just joined your team');
          convo.say('You must now /invite me to a channel so that I can be of use!');
        }
      });

    });
  }

});

var earsDirectOnly = ['direct_message', 'direct_mention'];
var earsEverywhere = ['direct_message', 'direct_mention', 'mention'];
var earsMentionOnly = ['direct_mention', 'mention'];

// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});

//respond to hello
controller.hears(['hello', 'hi'],earsEverywhere,function(bot,message) {

  controller.storage.users.get(message.user, function(err,user){
    //query for the user messaging us in storage
    if(user && user.name){
      //if this user exists and has a name in our system
      bot.reply(message, "Oh what's up, " + user.name);
    }
      else{
        bot.reply(message, "Hello.");
      }
    })
});

controller.hears(['call me (.*)'], earsEverywhere, function(bot, message){
  var matches = message.text.match(/call me (.*)/i);
  var name = matches[1];

  controller.storage.users.get(message.user, function(err, user){
    if(!user){
      user = {id: message.user};
    }
    user.name= name;
    controller.storage.users.save(user, function(err, id){
      bot.reply(message, "Oh, that's your name? Alright, I'll call you " + user.name + " from now on.");
    });
  });
});

controller.hears(['add admin (.*)'], 'direct_message', function(bot, message){
  var matches = message.text.match(/add admin (.*)/i);
  var name = matches[1];
  var userID = null;
  console.log(name);
  console.log(message);
  bot.api.users.list({}, function(err, response){
    if(err){
      bot.reply(message, "sorry, error looking up the user list, try again later");
    }else{
      for(var member in response.members){
        if(member.name == name){
          userID = member.id;
          break;
        }
      }
      if(userID == null){
        bot.reply(message, "Your user, " + name + " wasn't found in the team.");
      }
      else{
        controller.storage.users.save({id:userID, admin:true}, function(err, user){
        bot.reply(message, "Success, " + name + ", under ID " + userID + " was logged as an admin.");
        });
      }
    }
  });
 
});


controller.hears(['am I an admin'], 'direct_message', function(bot, message){
  controller.storage.users.get(message.user, function(err, user){
    if(user.admin){
      bot.reply(message, "yup, you da boss");
    }else{
      bot.reply(message, "YOU'RE NOT MY SUPERVISOR");
    }
  });
});

controller.hears(['shutdown'], earsEverywhere, function(bot,message){
  controller.storage.users.get(message.user, function(err, user){
    if(user.admin){
      bot.startConversation(message, function(err, convo){
        convo.ask("Are you sure you want me to shutdown?", [
        {
          pattern: bot.utterances.yes, 
          callback: function(response,convo){
            convo.say("Done. Bye!");
            convo.next();
            setTimeout(function(){
              process.exit();
            }, 3000);
          }
        },{
          pattern:bot.utterances.no,
          default:true,
          callback: function(response,convo){
            convo.say("*OH THANK GOD*");
            convo.next();
          }
        }
        ]);
        });  
    }else{
      bot.reply(message, "YOU'RE NOT MY SUPERVISOR");
    }
  });
});


/*
controller.hears('^stop',['direct_message', 'direct_mention'],function(bot,message) {
  bot.reply(message,'Goodbye');
  bot.rtm.close();
});
*/

/*
controller.on(['direct_message','mention','direct_mention'],function(bot,message) {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face',
  },function(err) {
    if (err) { console.log(err) }
    bot.reply(message,'I heard you loud and clear boss.');
  });
});
*/

controller.storage.teams.all(function(err,teams) {

  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (var t  in teams) {
    if (teams[t].bot) {
      controller.spawn(teams[t]).startRTM(function(err, bot) {
        if (err) {
          console.log('Error connecting bot to Slack:',err);
        } else {
          trackBot(bot);
        }
      });
    }
  }

});