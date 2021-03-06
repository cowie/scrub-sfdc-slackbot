/*
  Based off botkit - find that here
    -> http://howdy.ai/botkit
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

/* Uses the slack button feature to offer a real time bot to multiple teams */
var Botkit = require('botkit'); 
var Redis_Store = require('./redis_storage.js');
var redis_url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
var redis_store = new Redis_Store({url: redis_url});
var http = require('http');
const https = require('https');
var JSON = require('JSON');
var pg = require('pg');
var conString = process.env.DATABASE_URL;
var jsforce = require('jsforce');

require('./env.js');


//lazy vars 
var botID = "";
var cdgID = "";
var hanulID = "";


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



controller.on('file_share', function(bot, message){
  //bot.reply(message, "Linking to Salesforce...");
  console.log('brah look at that picture!');

  var publicLink = message.file.permalink_public;
  var linkSplit = publicLink.split('-');
  console.log(linkSplit);
  var secretCode = linkSplit[linkSplit.length - 1];
  var url = message.file.url_private + '?pub_secret=' + secretCode;
  console.log(message.file);

  //file ID
  var fileID = message.file.id;
  //filename
  var filename = message.file.name;
  //filetype
  var filetype = message.file.filetype;
  //projrect__c
  var channelID = message.channel;
  //username
  var username = message.user;


  var targetURL = 'https://slack.com/api/files.sharedPublicURL?token=TEST_TOKEN&file=' + message.file.id;

  https.get(targetURL, function(res2){
    var body = '';
    res2.on('data', function(chunk){
      body += chunk;
    });
    res2.on('end', function(){
      console.log(JSON.parse(body));
      //bot.reply(message, "This is a public link: " + url);

      //query to get the projectID from the channel.
      pg.connect(conString, function(err, client, done){
        if(err){
          console.error(err);bot.reply(message, "error connecting to postgres - " + err);
        }else{

          client.query("SELECT sfid FROM Salesforce.Project__c WHERE Slack_Channel_Id__c = '" + channelID + "'", function(err, result){
            if(err){
              console.error(err);bot.reply(message, "error connecting to postgres - " + err);
            }else{
              //we now have the ID for the project.
              var projectID = result.rows[0].sfid;
              console.log('project id is '+ projectID);
              var conn = new jsforce.Connection();
              conn.login('USERNAME', 'PASSWORD', function(err,res){
                if(err){
                  console.error(err);bot.reply(message, 'ran into a problem logging into sfdc: ' + err);
                }else{
                  if(username == botID){username = "sfdc_ninja";}
                  else if(username == cdgID){username = "cdegour";}
                  else if(username == hanulID){username = "hanulpark";}
                  conn.sobject("Project_File__c").create({
                    file_id__c:fileID,
                    file_link__c:url,
                    file_name__c:filename,
                    file_type__c:filetype,
                    project__c:projectID,
                    username__c:username
                  }, function(err, ret){
                    console.log("HOLY F IT WORKED");
                    var attachments = [];
                    var attach = {
                      fallback: "Successful sync into Salesforce",
                      color: "00A1E0",
                      pretext: "Picture sync confirmation",
                      title: filename,
                      title_link: "https://na30.salesforce.com/" + projectID,
                      text: "Click link to view in Salesforce. All comments will be mapped across to both systems from this point."
                    }
                    attachments.push(attach);
                    bot.reply(message, {text:"", attachments:attachments});
                  });
                }
              });
            }
          })  
        }
      })


    });
  });

});


//webservice handling
controller.setupWebserver(process.env.port,function(err,webserver) {

  webserver.get('/', function(req, res){
    res.sendFile('index.html', {root:__dirname})
  });


  //USECASE 1: API Calls into System to Talk
  webserver.get('/sayHello', function(req,res){
    //controller.say({text:'Hi everyone!', channel:'general'});
    res.send('Success!');
  });


  webserver.get('/createChannel', function(req, res){
    
    console.log(req);
    console.log(req.url);
    console.log(req.url.Query);
    var chanName = req.url.substring(req.url.indexOf('name=')+4);
    console.log(chanName);

    
    var targetURL = 'https://slack.com/api/channels.create?token=TEST_TOKEN' + '&name=' + chanName;
    

    var channelID;
    var resp1;
    var resp2;

    https.get(targetURL, function(res2){
      var body = '';
      res2.on('data', function(chunk){
        body += chunk;
      });
      res2.on('end', function(){
        //console.log(JSON.parse(body));
        resp1 = JSON.parse(body);
        //res.send(JSON.parse(body));
        channelID = JSON.parse(body).channel.id;
        console.log("**CHANNEL CREATED**")
        targetURL = "https://slack.com/api/channels.invite?token=TEST_TOKEN" + "&channel=" + channelID + "&user=" + botID;
        console.log("aiming at " + targetURL);
        https.get(targetURL, function(res3){
          var body2 = '';
          res3.on('data', function(chunk){
            body2 += chunk;
          });
          res3.on('end', function(){
            console.log("INVIIIITE");
            console.log(JSON.parse(body));
            console.log("INVITE SENT");
            res.send(body + body2);
          });
        });
      });
    });
    //auto-invite bot of ID U0Z8R0K0D

  });

  webserver.post('/postMessage', function(req, res){
    console.log(req);
    
    var channel = req.body.channel;
    channel.replace(/ /g, '%20');
    channel.replace(/#/g, '%23');

    var message = req.body.message;
    message = decodeURI(message);
    var author_name = req.body.author_name;
    var author_id = req.body.post_id;

    var project_name = req.body.project_name;
    var postId = req.body.project_id;
    var status_name = req.body.status_name;
    var project_status = req.body.project_status != null ? req.body.project_status : "No status";

    var text = 'Message from Salesforce';
    var username = "Salesforce Bot";

    var attachments = [];
    var attachment = {
      "fallback": message,
      "color": "#009CDB",
      "author_name": author_name,
      "author_link": "https://na30.salesforce.com/" + author_id,
      "title": project_name,
      "title_link": "https://na30.salesforce.com/" + postId,
      "text": message,
      "fields": [
          {
              "title": status_name,
              "value": project_status,
              "short": false
          }
      ]
    };

    attachments.push(attachment);
    attachments = JSON.stringify(attachments);

    var targetURL = 'https://slack.com/api/chat.postMessage?token=TEST_TOKEN' + 
      '&channel=' + channel +  
      '&text=' + encodeURIComponent(message) +
      '&attachments=' + encodeURIComponent(attachments) + 
      '&username=SFDC';

    console.log(targetURL);

    https.get(targetURL, function(res2){
      var body = '';
      res2.on('data', function(chunk){
        body += chunk;
      });
      res2.on('end', function(){
        console.log(JSON.parse(body));
        res.send('Success!');
      });
    });
  });
  
  webserver.post('/postChatterMessage', function(req, res){
    console.log(req);
    
    var channel = req.body.channel;
    channel.replace(/ /g, '%20');
    channel.replace(/#/g, '%23');

    var message = req.body.message;
    message = decodeURI(message);
    var author_name = req.body.author_name;
    var author_id = req.body.post_id;

    var project_name = req.body.project_name;
    var postId = req.body.project_id;
    var status_name = req.body.status_name;
    var project_status = req.body.project_status != null ? req.body.project_status : "No status";

    var text = 'Message from Salesforce';
    var username = "Salesforce Bot";

    var attachments = [];
    var attachment = {
      "fallback": "New chatter post in Salesforce",
      "color": "#009CDB",
      "author_name": author_name,
      "author_link": "https://na30.salesforce.com/" + author_id,
      "title": project_name,
      "title_link": "https://na30.salesforce.com/" + postId,
      "text": "",
      "fields": [
          {
              "title": "",
              "value": message,
              "short": false
          }
      ]
    };

    attachments.push(attachment);
    attachments = JSON.stringify(attachments);

    var targetURL = 'https://slack.com/api/chat.postMessage?token=TEST_TOKEN' + 
      '&channel=' + channel +  
      '&text=' + "New Chatter Post from Salesforce" +
      '&attachments=' + encodeURIComponent(attachments) + 
      '&username=SFDC';

    console.log(targetURL);

    https.get(targetURL, function(res2){
      var body = '';
      res2.on('data', function(chunk){
        body += chunk;
      });
      res2.on('end', function(){
        console.log(JSON.parse(body));
        res.send('Success!');
      });
    });
  });
  
  webserver.post('/addFileComment', function(req, res){
    console.log(req);
    
    var targetURL = 'https://slack.com/api/files.comments.add?token=TEST_TOKEN' +
    '&file=' + req.body.file_id + 
    '&comment=' + req.body.comment;

    https.get(targetURL, function(res2){
      var body = '';
      res2.on('data', function(chunk){
        body += chunk;
      });
      res2.on('end', function(){
        console.log(JSON.parse(body));
        res.send('Success!');
      });
    });
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


//USECASE 3: HEAR Message to update, update accurate record in SFDC
controller.hears('update (.*) to (.*)', earsMentionOnly, function(bot, message){
  //bot.reply(message, "Yo, so first, matches0 is:" + message.match[0] + ", next matches1 is:" + message.match[1]+ ", finally matches2 is:" + message.match[2]);
  //probably want to push this direct to sfdc
  var channelID = message.channel;
  //need to clean up the fieldName.
  var fieldName = message.match[1];
  fieldName = fieldName.replace(/ /g, "_");
  fieldName = fieldName + "__c";
  //need to set the value
  var value = message.match[2];

  //alright now based on channelID, we need to insert into SDFC, that'll be a https get request and a pg query.
  pg.connect(conString, function(err, client, done){
    if(err){
      console.error(err);bot.reply(message, "error connecting to postgres - " + err);
    }else{
      client.query("UPDATE Salesforce.Project__c SET " + fieldName + " = ($1) WHERE Slack_Channel_Id__c =($2)", [value, channelID], function(err, result){
        if(err){
            console.error(err);bot.reply(message, "error making update - " + err);
          }else{
            console.log("Update went through");
            client.query("SELECT sfid, Name, Description__c FROM Salesforce.Project__C WHERE Slack_Channel_Id__c = '" + channelID + "'", function(err2, result2){
              if(err2){
                console.error(err2);bot.reply(message, "error getting data, but update was successful - " + err2);
              }else{
                console.log('updated, adn got message back');
                var fieldName = message.match[1];
                fieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
                var attachments = [];
                var attach = {
                  fallback: "Successful update. Set " + message.match[1] + " to the value of " + value,
                  color: "00A1E0",
                  pretext: "Update Successful",
                  title: result2.rows[0].name,
                  title_link: "https://na30.salesforce.com/" + result2.rows[0].sfid,
                  text: result2.rows[0].description__c,
                  fields:[
                    {
                      "title": fieldName,
                      "value": value,
                      "short": false
                    }
                  ]
                } 
                attachments.push(attach);
                console.log('sending bot reply');
                bot.reply(message, {text: "Update!", attachments:attachments}, function(err, resp){console.log('bot sent');console.log(err, resp);});   
              }
            });
            //bot.reply(message, "Successfully updated project, setting " + message.match[1] + " to the value of " + value + " inside Salesforce.");
          }
      })
    }
  });

});


//respond to hello


controller.hears(['list T1 cases'], earsEverywhere, function(bot,message){
  pg.connect(conString, function(err, client, done){
    if(err){
      console.error(err);bot.reply(message, "error connecting to postgres - " + err);
    }else{
      client.query("SELECT Id, AccountId, CaseNumber, Channel__c, ContactId, Cost__c, CreatedDate, OwnerId, Priority, Status, Subject, Description FROM Salesforce.Case WHERE OwnerId = '00G360000012GmfEAE'",
        function(err, result){
          if(err){
            console.error(err);bot.reply(message, "error making query - " + err);
          }else{
            console.log('YUPPPP');
            bot.reply(message, "Here are all the Tier 1 queue cases currently");
            var row;
            console.log(result.rows);
            for(var x=0; x<result.rows.length; x++){
              row = result.rows[x];
              console.log(row);
              bot.reply(message, "*: " + row.casenumber + " | " + row.status + " | " + row.subject);
            
            }
            bot.reply(message, "End case list");
          }
        });
    }
  });
});
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

controller.hears(['chuck norris'], earsEverywhere, function(bot, message){
  http.get('http://api.icndb.com/jokes/random', function(res){
    var body = '';
    res.on('data', function(chunk){
      body += chunk;
    });
    res.on('end', function(){
      var parsed = JSON.parse(body);
      bot.reply(message, parsed.value.joke);
    });
  });
})

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

  //admin check
  
  var isAdmin = false;
  controller.storage.users.get(message.user, function(err, user){
    isAdmin = user.admin;
    if(!isAdmin){
     bot.reply(message, "YOU AREN'T MY SUPERVISOR");
      return;
    }else{
      bot.api.users.list({}, function(err, response){
        if(err){
          bot.reply(message, "sorry, error looking up the user list, try again later");
        }else{
          console.log(response.members);
          for(var x=0;x<response.members.length;x++){
            var member = response.members[x];
            console.log(response.members[x]);
            console.log("Checking " + name + " against " + member.id + " " + member.name);
            if(member.name == name){
              userID = member.id;
              break;
            }
          }
          
          if(userID == null){
            bot.reply(message, "Your user, " + name + " wasn't found in the team.");
          }
          else{
            controller.storage.users.save({id:userID, admin:true, name:name}, function(err, user){
            bot.reply(message, "Success, " + name + ", under ID " + userID + " was logged as an admin.");
            });
          }
        }
      });
    }
  });
});

controller.hears(['remove admin (.*)'], 'direct_message', function(bot, message){
  var matches = message.text.match(/add admin (.*)/i);
  var name = matches[1];
  var userID = null;
  //admin check
  var isAdmin = false;
  controller.storage.users.get(message.user, function(err, user){
    isAdmin = user.admin;
  });
  if(!isAdmin){
    bot.reply(message, "YOU AREN'T MY SUPERVISOR");
    return;
  }

  bot.api.users.list({}, function(err, response){
    if(err){
      bot.reply(message, "sorry, error looking up the user list, try again later");
    }else{
      console.log(response.members);
      for(var x=0;x<response.members.length;x++){
        var member = response.members[x];
        console.log(response.members[x]);
        console.log("Checking " + name + " against " + member.id + " " + member.name);
        if(member.name == name){
          userID = member.id;
          break;
        }
      }
      
      if(userID == null){
        bot.reply(message, "Your user, " + name + " wasn't found in the team.");
      }
      else{
        controller.storage.users.save({id:userID, admin:false, name:name}, function(err, user){
        bot.reply(message, "Success, " + name + ", under ID " + userID + " was removed as an admin.");
        });
      }
    }
  });
});

controller.hears(['am I an admin'], 'direct_message', function(bot, message){
  //admin check
  //uncrash
  var isAdmin = false;
  controller.storage.users.get(message.user, function(err, user){
    isAdmin = user.admin;
    if(!isAdmin){
      bot.reply(message, "YOU AREN'T MY SUPERVISOR");
      return;
    }
    else{
      bot.reply(message, "Yup, you da boss");
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