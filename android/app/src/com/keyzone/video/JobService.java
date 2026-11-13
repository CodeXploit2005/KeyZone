package com.keyzone.video;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import com.arthenica.ffmpegkit.FFmpegKit;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.UUID;

public class JobService extends Service {
    private static volatile boolean running,stop;
    private static volatile String label="",target="",operation="";
    private PowerManager.WakeLock wake;
    static synchronized void enqueue(Context context,String kind,String id) throws Exception {
        License.get(context).requireValid(true);
        if(running)throw new Exception("Một tác vụ đang chạy. Hãy chờ hoặc dừng tác vụ trước.");
        if(!kind.matches("script|produce|render|character|thumbnail|posts|shorts|selftest"))throw new Exception("Tác vụ không hợp lệ.");
        running=true;stop=false;target=id;operation=kind;label="Đang chuẩn bị…";
        try{context.startForegroundService(new Intent(context,JobService.class).putExtra("kind",kind).putExtra("id",id));}
        catch(Exception error){running=false;throw error;}
    }
    static boolean busy(){return running;}
    static boolean cancelled(){return running&&stop;}
    static JSONObject progress() throws Exception {return new JSONObject().put("label",label).put("id",target).put("kind",operation);}
    static void cancel(){stop=true;FFmpegKit.cancel();try{MuseEngine.get(StoreContext.context).cancel();}catch(Exception ignored){}}
    static void update(String value,String id){label=value;target=id;MainActivity.event("keyzone-changed",new JSONObject());}
    static String friendly(Throwable error){
        while(error.getCause()!=null)error=error.getCause();String message=error.getMessage();
        if(message==null||message.trim().isEmpty())return "Tác vụ chưa hoàn tất. Vui lòng thử lại.";
        if(message.contains("找不到聊天输入框")||message.contains("Muse is disconnected"))return MuseEngine.DISCONNECTED;
        return message;
    }
    @Override public void onCreate(){super.onCreate();StoreContext.context=getApplicationContext();NotificationManager notifications=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);notifications.createNotificationChannel(new NotificationChannel("keyzone-jobs","Tạo video KeyZone",NotificationManager.IMPORTANCE_LOW));}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null){running=false;stopSelf();return START_NOT_STICKY;}
        if("cancel".equals(intent.getAction())){cancel();return START_NOT_STICKY;}
        String kind=intent.getStringExtra("kind"),id=intent.getStringExtra("id");
        PendingIntent open=PendingIntent.getActivity(this,1,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        PendingIntent cancel=PendingIntent.getService(this,2,new Intent(this,JobService.class).setAction("cancel"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification notification=new Notification.Builder(this,"keyzone-jobs").setContentTitle("KeyZone Video Studio").setContentText("Đang xử lý dự án trên điện thoại").setSmallIcon(android.R.drawable.ic_media_play).setContentIntent(open).setOngoing(true).addAction(android.R.drawable.ic_media_pause,"Dừng",cancel).build();
        if(Build.VERSION.SDK_INT>=35)startForeground(7,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC|ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING);else startForeground(7,notification);
        PowerManager power=(PowerManager)getSystemService(POWER_SERVICE);wake=power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"KeyZone:VideoJob");wake.acquire(6*60*60*1000L);
        new Thread(()->{
            final java.util.concurrent.atomic.AtomicBoolean finished=new java.util.concurrent.atomic.AtomicBoolean(false);
            final java.util.concurrent.atomic.AtomicReference<String> licenseError=new java.util.concurrent.atomic.AtomicReference<>();
            Thread monitor=new Thread(()->{
                try {
                    while(!finished.get()) {
                        Thread.sleep(30000);
                        LicenseGate.Reply state=License.get(this).status(true);
                        synchronized(JobService.class) {
                            if(!finished.get()&&!state.valid){licenseError.set(state.error);cancel();break;}
                        }
                    }
                } catch(InterruptedException ignored) { Thread.currentThread().interrupt(); }
            },"KeyZoneLicense");
            monitor.start();
            try{License.get(this).requireValid(true);execute(kind,id);if(licenseError.get()!=null)throw new Exception(licenseError.get());update("Đã hoàn tất",id);}
            catch(Exception error){
                String message=licenseError.get()!=null?licenseError.get():friendly(error);label=message;
                try{Store store=Store.get(this);String entity=kind.equals("character")?"characters":kind.equals("selftest")?"meta":"projects";JSONObject row=store.find(entity,id);
                    if(row!=null){row.put("error",message);if(kind.equals("script")||kind.equals("produce")||kind.equals("render")||kind.equals("character"))row.put("status","failed");store.save(entity,row);}
                }catch(Exception ignored){}
            }finally{synchronized(JobService.class){finished.set(true);running=false;stop=false;}monitor.interrupt();if(wake!=null&&wake.isHeld())wake.release();MainActivity.event("keyzone-changed",new JSONObject());stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
        },"KeyZoneJob").start();
        return START_NOT_STICKY;
    }
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onTimeout(int startId,int fgsType){cancel();running=false;stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
    private void execute(String kind,String id) throws Exception {
        Store store=Store.get(this);MediaRenderer renderer=new MediaRenderer(this);
        if(kind.equals("selftest")){update("Đang kiểm tra bộ xuất video…",id);String file=renderer.selfTest();store.save("meta",new JSONObject().put("id",id).put("status","ready").put("file",file));return;}
        if(kind.equals("character")){
            JSONObject character=store.required("characters",id);store.save("characters",character.put("status","generating").put("error",""));update("Đang tạo ảnh nhân vật…",id);
            String prompt="Generate a clear character reference image, one character, consistent identity, neutral clean background. "+character.optString("description")+". Name: "+character.optString("name");
            String file=MuseEngine.get(this).media(prompt,"image",null);store.save("characters",character.put("referenceFile",file).put("status","ready"));return;
        }
        JSONObject project=store.required("projects",id);JSONObject niche=store.required("niches",project.getString("nicheId"));
        project.remove("error");store.save("projects",project);
        if(kind.equals("script")){script(store,project,niche);return;}
        if(kind.equals("produce")){
            JSONArray scenes=project.getJSONArray("scenes");MainActivity.validateScenes(scenes);project.put("status","producing").put("error","");store.save("projects",project);
            JSONArray refs=new JSONArray();if(!project.optString("referenceFile").isEmpty())refs.put(project.getString("referenceFile"));
            JSONArray cast=project.optJSONArray("characterIds");StringBuilder castText=new StringBuilder();
            if(cast!=null)for(int i=0;i<cast.length();i++){JSONObject character=store.required("characters",cast.getString(i));if(!character.optString("referenceFile").isEmpty())refs.put(character.getString("referenceFile"));castText.append(character.optString("name")).append(": ").append(character.optString("description")).append(". ");}
            String collage=renderer.collage(refs);File reference=collage==null?null:store.file(collage);
            boolean imported=project.optString("scriptSource").startsWith("imported-");
            for(int i=0;i<scenes.length();i++){
                License.get(this).requireValid(false);
                if(cancelled())throw new Exception("Đã dừng tác vụ.");JSONObject scene=scenes.getJSONObject(i);
                if(scene.optString("status").equals("done")&&!scene.optString("clipFile").isEmpty()&&store.file(scene.getString("clipFile")).isFile())continue;
                String image=scene.optString("imageFile");
                if(image.isEmpty()||!store.file(image).isFile()){
                    update("Đang tạo ảnh cảnh "+(i+1)+"/"+scenes.length(),id);scene.put("status","drawing");store.save("projects",project);
                    if(i>0&&scene.optBoolean("continuesPrevious")&&!scenes.getJSONObject(i-1).optString("clipFile").isEmpty())image=renderer.lastFrame(scenes.getJSONObject(i-1).getString("clipFile"));
                    else image=MuseEngine.get(this).media("Generate an image. "+scene.getString("visualPrompt")+". "+(imported?"":niche.optString("visualStyle")+". Characters: "+castText)+". Frame aspect ratio "+project.optString("aspectRatio"),"image",reference);
                    scene.put("imageFile",image);store.save("projects",project);
                }
                update("Đang tạo video cảnh "+(i+1)+"/"+scenes.length(),id);scene.put("status","animating");store.save("projects",project);
                try{
                    String video=MuseEngine.get(this).media("Create a video from the reference image. "+scene.getString("visualPrompt")+". Camera: "+scene.optString("camera")+". Keep the same character identities and composition. Duration "+niche.optInt("sceneSeconds",8)+" seconds. Aspect ratio "+project.optString("aspectRatio"),"video",store.file(image));
                    scene.put("clipFile",video).put("status","done").remove("error");store.save("projects",project);
                }catch(Exception error){scene.put("status","failed").put("error",friendly(error));store.save("projects",project);throw error;}
            }
        }
        if(kind.equals("produce")||kind.equals("render")){
            project.put("status","rendering").put("error","");store.save("projects",project);update("Đang xuất video…",id);
            String file=renderer.render(project,niche);store.save("projects",project.put("videoFile",file).put("status","done").put("error",""));return;
        }
        if(kind.equals("thumbnail")){
            update("Đang tạo thumbnail…",id);JSONArray scenes=project.getJSONArray("scenes");String image="";
            for(int i=0;i<scenes.length()&&image.isEmpty();i++)image=scenes.getJSONObject(i).optString("imageFile");
            if(image.isEmpty()&&!project.optString("videoFile").isEmpty())image=renderer.lastFrame(project.getString("videoFile"));
            if(image.isEmpty())throw new Exception("Hãy tạo ít nhất một cảnh trước khi tạo thumbnail.");
            String file=renderer.thumbnail(project,image,project.optString("thumbnailHeadline",project.getString("title")));store.save("projects",project.put("thumbnailFile",file));return;
        }
        if(kind.equals("posts")){
            update("Đang viết nội dung đăng video…",id);
            String text=chat("Viết tiêu đề, mô tả YouTube, caption TikTok, Instagram và Facebook cho video sau bằng tiếng Việt. Trả về văn bản dễ sao chép theo từng nền tảng, không thêm lời giải thích. Chủ đề: "+project.optString("topic")+". Kịch bản: "+project.optJSONArray("scenes"));
            store.save("projects",project.put("posts",text));return;
        }
        if(kind.equals("shorts")){
            String video=project.optString("videoFile");if(video.isEmpty())throw new Exception("Hãy xuất video chính trước khi tạo Shorts.");
            double total=MediaRenderer.duration(store.file(video));update("Đang chọn đoạn Shorts…",id);
            String reply=chat("Chọn tối đa 3 đoạn hấp dẫn trong video dài "+total+" giây. Mỗi đoạn từ 1 tới 60 giây, không vượt thời lượng video. Chỉ trả JSON {\"segments\":[{\"title\":\"...\",\"start\":0,\"end\":20}]}. Kịch bản: "+project.optJSONArray("scenes"));
            JSONArray segments=parseJson(reply).getJSONArray("segments"),shorts=new JSONArray();
            for(int i=0;i<Math.min(3,segments.length());i++){
                JSONObject segment=segments.getJSONObject(i);double start=segment.getDouble("start"),end=segment.getDouble("end");
                if(start<0||end>total+0.1||end<=start||end-start>60)throw new Exception("Muse trả về mốc Shorts chưa hợp lệ. Hãy thử lại.");
                update("Đang dựng Shorts "+(i+1),id);String file=UUID.randomUUID()+".mp4";
                MediaRenderer.run("-y","-ss",String.valueOf(start),"-i",store.file(video).getAbsolutePath(),"-t",String.valueOf(end-start),"-vf","scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1","-c:v","h264_mediacodec","-b:v","4000000","-c:a","aac","-movflags","+faststart",store.file(file).getAbsolutePath());
                shorts.put(new JSONObject().put("title",segment.optString("title","Short "+(i+1))).put("file",file).put("duration",end-start));
            }
            store.save("projects",project.put("shorts",shorts));return;
        }
        throw new Exception("Tác vụ không hợp lệ.");
    }
    private void script(Store store,JSONObject project,JSONObject niche) throws Exception {
        project.put("status","scripting").put("error","");store.save("projects",project);update("Đang viết kịch bản…",project.getString("id"));
        int count=Math.max(1,Math.min(40,project.optInt("sceneCount",niche.optInt("sceneCount",6))));
        String prompt="Viết kịch bản video gồm đúng "+count+" cảnh, chủ đề: "+project.optString("topic")+". Ngôn ngữ: "+niche.optString("language","vi")+". Giọng điệu: "+niche.optString("tone")+". Hướng dẫn ngách: "+niche.optString("scriptInstructions")+". Phong cách hình ảnh: "+niche.optString("visualStyle")+". Chỉ trả về một JSON hợp lệ, không markdown, với dạng {\"title\":\"Tên video\",\"scenes\":[{\"narration\":\"Lời đọc\",\"visualPrompt\":\"Detailed English image and motion prompt\",\"camera\":\"camera direction\",\"continuesPrevious\":false}]}. Mỗi cảnh phải có visualPrompt chi tiết. "+(niche.optString("format").equals("wordless")?"Video không lời: narration để trống.":"");
        JSONObject result=parseJson(chat(prompt));JSONArray scenes=result.getJSONArray("scenes");MainActivity.validateScenes(scenes);
        if(scenes.length()!=count)throw new Exception("Muse trả về sai số cảnh yêu cầu. Hãy thử viết lại kịch bản.");
        for(int i=0;i<scenes.length();i++){JSONObject scene=scenes.getJSONObject(i);scene.put("status","pending");scene.remove("imageFile");scene.remove("clipFile");}
        store.save("projects",project.put("title",result.optString("title",project.getString("title"))).put("scenes",scenes).put("status","script_ready").put("scriptSource","generated"));
    }
    private String chat(String prompt) throws Exception {
        JSONObject settings=Store.get(this).settings();String base=settings.optString("CF_AIG_BASE_URL"),token=settings.optString("CF_AIG_TOKEN");
        if(!base.isEmpty()&&!token.isEmpty()){
            HashMap<String,String> headers=new HashMap<>();headers.put("Authorization","Bearer "+token);
            JSONObject body=new JSONObject().put("model",settings.optString("SCRIPT_MODEL","deepseek/deepseek-chat")).put("messages",new JSONArray().put(new JSONObject().put("role","user").put("content",prompt)));
            JSONObject response=new JSONObject(new String(Http.post(base.replaceAll("/+$","")+"/chat/completions",body,headers),StandardCharsets.UTF_8));
            return response.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content");
        }
        return MuseEngine.get(this).chat(prompt);
    }
    static JSONObject parseJson(String text) throws Exception {
        int start=text.indexOf('{'),end=text.lastIndexOf('}');if(start<0||end<=start)throw new Exception("Muse chưa trả về JSON kịch bản hợp lệ. Hãy thử lại.");
        return new JSONObject(text.substring(start,end+1));
    }
    private static final class StoreContext {static Context context;}
}
