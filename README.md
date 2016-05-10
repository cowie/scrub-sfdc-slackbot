# scrub-sfdc-slackbot

I should warn you - this was a POC rush job for a customer. The commit messages are hopefully lost to time.

Uses https://github.com/howdyai/botkit as a baseline for the build, with some additional whatnot thrown in for the usecase required.

Assumes a model of the API User from Heroku making changes that take place in SFDC. This may not be ideal given that you're going to want to attribute the specific Slack User to the SFDC User. Best bet here would be a table linked across of SFDC User-Slack ID mappings. This then lets you attack it from two angles, proper Oauth or a named principal API user.

1) OAuth app once with Slack, OAuth API with SFDC - Allows user-controlled acceptance of using the hook in the first place, attributes the API calls happening to that user, etc. Pros include proper security being mapped on the SFDC side. Cons include a somewhat more complicated buildout to handle security concerns (is there a way a hacker could spoof a message to the bot as another user, etc).

2) Single API User spoofing other users (via modify system fields permission) - Much simpler buildout, but unable to process permission differences between Slack users. 

Both would allow you to keep a valid user table, and probably start up an Admin table as well for maintenance. This means you could potentially invite external/partner users into your Slack channel, whether SFDC users or not, and they would be unable to process commands on the bot due to missing perms.
