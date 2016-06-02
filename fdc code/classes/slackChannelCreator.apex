public class slackChannelCreator {
    @InvocableMethod(label='Create Slack channel' description='Creates a channel on slack team from the given name')
    public static void createChannel(List<String> channelNames){
        Slack_Integration.postchannels(channelNames);
    }  
}