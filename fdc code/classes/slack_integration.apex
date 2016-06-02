public class Slack_Integration {
    
    @future(callout=true)
    public static void attachFile(String fileName, String fileType, String parentId, String url, String fileId, String username){
        
        String targetURL = url;
        
        httpRequest req = new httpRequest();
        req.setEndpoint(targetURL);
        req.setMethod('GET');
        
        http http = new http ();
        httpResponse res = http.send(req);
        
        ContentVersion content = new ContentVersion();
        content.Title = fileName;
        content.PathOnClient = fileName + '.' + fileType;
        content.VersionData = res.getBodyAsBlob();
        
        insert content;
        
        FeedItem contentPost = new FeedItem();
        contentPost.body = 'New file has been posted by ' + username + '.';
        contentPost.ParentId = parentId;
        contentPost.RelatedRecordId = content.id;
        contentPost.Type = 'ContentPost';
        
        insert contentPost;
        
        Project_File__c projectFile = new Project_File__c();
        projectFile.Id = fileId;
        projectFile.Post_Id__c = contentPost.Id;
        
        update projectFile;
    }
    
    @future(callout=true)
    public static void postChannels(List<String> channels){
        
        List<Project__c> allProjects = new List<Project__c>();
        List<Project__c> addedChannelId = new List<Project__c>();
        allProjects = [Select Id, Slack_Channel_Id__c, Slack_Channel__c From Project__c Where Slack_Channel_Id__c = null];
        
        
        for(String channel: channels){
            String targetURL = 'http://sfdc-slack-demo.herokuapp.com/createChannel?name=' + channel;
            
            httpRequest req = new httpRequest();
            req.setEndpoint(targetURL);
            req.setMethod('GET');
            
            http http = new http();
            httpResponse res = http.send(req);
            
            
            ChannelResponse chanRes = (ChannelResponse)JSON.deserialize(res.getBody(), ChannelResponse.class);
            
            System.debug(chanRes);
            
            for(Project__c p: allProjects) {
                if(p.Slack_Channel__c == channel){
                    p.Slack_Channel_Id__c = chanRes.Channel.id;
                    addedChannelId.add(p);
                }
            }
        }
        
        if(addedChannelId.size() > 0){
            update addedChannelId;
        }
    }
    
    @future(callout=true)
    public static void postFeed(String message, String channelId, String posterName, String postId, String projectName, String projectId, String statusName, String status){
        
        String text = message.replaceAll('<[^>]+>','');
        text = text.replaceAll('!slack', '');
        text = text.replaceAll('&#39;', '\'');
        
        System.debug(text);
        
        String targetURL = 'http://sfdc-slack-demo.herokuapp.com/postMessage';
        String requestBody = 'channel=' + channelId +
                             '&message=' + text +
                             '&author_name=' + posterName +
                             '&post_id=' + postId +
                             '&project_name=' + projectName +
                             '&project_id=' + projectId +
                             '&status_name=' + statusName + 
                             '&project_status=' +  status;
        
        
        httpRequest req = new httpRequest();
        req.setEndpoint(targetURL);
        req.setBody(requestBody);
        req.setMethod('GET');
        
        http http = new http ();
        httpResponse res = http.send(req);
        
        System.debug(res.getBody());
    }
    
    @future(callout=true)
    public static void postChatterFeed(String message, String channelId, String posterName, String postId, String projectName, String projectId, String statusName, String status){
        
        String text = message.replaceAll('<[^>]+>','');
        text = text.replaceAll('#slack', '');
        text = text.replaceAll('&#39;', '\'');
        
        System.debug(text);
        
        String targetURL = 'http://sfdc-slack-demo.herokuapp.com/postChatterMessage';
        String requestBody = 'channel=' + channelId +
                             '&message=' + text +
                             '&author_name=' + posterName +
                             '&post_id=' + postId +
                             '&project_name=' + projectName +
                             '&project_id=' + projectId +
                             '&status_name=' + statusName + 
                             '&project_status=' +  status;
        
        
        httpRequest req = new httpRequest();
        req.setEndpoint(targetURL);
        req.setBody(requestBody);
        req.setMethod('GET');
        
        http http = new http ();
        httpResponse res = http.send(req);
        
        System.debug(res.getBody());
    }
    
    
    @future(callout=true)
    public static void addFileComment(String fileId, String comment){
        
        String encodedComment = EncodingUtil.urlEncode(comment,'UTF-8');

        
        String targetURL = 'http://sfdc-slack-demo.herokuapp.com/addFileComment';
        String requestBody = 'file_id=' + fileId +
                             '&comment=' + encodedComment;
                             
        httpRequest req = new httpRequest();
        req.setEndpoint(targetURL);
        req.setBody(requestBody);
        req.setMethod('GET');
        
        http http = new http ();
        httpResponse res = http.send(req);
        
        System.debug(res.getBody());
    }
    
    public class ChannelResponse {
        public Boolean ok;
        public Channel channel;
    }
    
    
    public class Channel {
        public String id;
        public String name;
        public Boolean is_channel;
        public Integer created;
        public String creator;
        public Boolean is_archived;
        public Boolean is_general;
        public Boolean is_member;
        public String last_read;
        public Object latest;
        public Integer unread_count;
        public Integer unread_count_display;
        public List<String> members;
        public Topic topic;
        public Topic purpose;
    }

    public class Topic {
        public String value;
        public String creator;
        public Integer last_set;
    }
}