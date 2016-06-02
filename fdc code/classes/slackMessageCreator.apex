public class slackMessageCreator {
    @InvocableMethod(label='Create post per chatter message' description='Creates a post for each message on a project')
    public static void createFeed(List<FeedItem> posts){
        Slack_Integration.postFeed(posts);
    }  
}