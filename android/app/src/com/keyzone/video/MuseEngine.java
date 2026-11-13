package com.keyzone.video;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

final class MuseEngine {
    static final String DISCONNECTED="Không thể tạo video vì Muse bị mất kết nối. Mở Muse và gửi ticket để kết nối lại, hoặc thay tài khoản.";
    private static MuseEngine instance;
    private final Context context;
    private final Store store;
    private final WebView web;
    private volatile String activeId="";
    private volatile boolean navigating;
    private volatile Task task;
    private final String taskScript;

    static MuseEngine get(Context context) throws Exception {
        if(instance==null) {
            if(Looper.myLooper()!=Looper.getMainLooper()) {
                CompletableFuture<MuseEngine> future=new CompletableFuture<>();
                MainActivity.MAIN.post(()->{try{future.complete(get(context));}catch(Exception error){future.completeExceptionally(error);}});
                return future.get(15,TimeUnit.SECONDS);
            }
            synchronized(MuseEngine.class) { if(instance==null)instance=new MuseEngine(context.getApplicationContext()); }
        }
        return instance;
    }
    private MuseEngine(Context context) throws Exception {
        this.context=context;store=Store.get(context);taskScript=MainActivity.readAsset(context,"muse-task.js");
        web=new WebView(context);MainActivity.configure(web);
        web.setWebChromeClient(new android.webkit.WebChromeClient());
        web.getSettings().setOffscreenPreRaster(true);web.getSettings().setUseWideViewPort(true);web.getSettings().setLoadWithOverviewMode(true);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,android.webkit.WebResourceRequest request){return !"https".equals(request.getUrl().getScheme());}
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){navigating=true;}
            @Override public void onPageFinished(WebView view,String url){navigating=false;}
        });
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
        web.addJavascriptInterface(new ResultBridge(),"MuseResult");
    }
    WebView view(){return web;}
    void login(){activeId="";CookieManager.getInstance().removeAllCookies(value->{CookieManager.getInstance().flush();navigating=true;web.loadUrl("https://muse.ai/thread/new");});}
    private String evaluate(String javascript) throws Exception {
        CompletableFuture<String> result=new CompletableFuture<>();
        MainActivity.MAIN.post(()->web.evaluateJavascript(javascript,result::complete));
        return result.get(15,TimeUnit.SECONDS);
    }
    private JSONObject inspect() throws Exception {
        String raw=evaluate("(()=>{const es=[...document.querySelectorAll('textarea,[role=textbox][contenteditable=true]')];const input=es.find(e=>e.getClientRects().length&&!e.disabled);const h=document.querySelector('[data-hatch-shell-hydration-state]');return {host:location.hostname,body:(document.body?.innerText||'').slice(0,2000),input:!!input,hydrated:!h||h.getAttribute('data-hatch-shell-hydration-state')==='hydrated'};})()");
        return raw==null||raw.equals("null")?new JSONObject():new JSONObject(raw);
    }
    private void ready(String accountId,int seconds) throws Exception {
        long deadline=System.currentTimeMillis()+seconds*1000L;
        while(System.currentTimeMillis()<deadline){
            if(JobService.cancelled())throw new Exception("Đã dừng tác vụ.");
            if(navigating){Thread.sleep(300);continue;}
            JSONObject state=inspect();String body=state.optString("body").toLowerCase();
            if(body.contains("muse is disconnected")||body.contains("we disconnected muse to protect your information")){
                mark(accountId,"disconnected",DISCONNECTED);throw new Exception(DISCONNECTED);
            }
            if(state.optString("host").equals("muse.ai")&&state.optBoolean("input")&&state.optBoolean("hydrated")&&!body.contains("connecting..."))return;
            Thread.sleep(500);
        }
        mark(accountId,"unknown","Chưa xác minh được workspace. Hãy thử kiểm tra lại.");
        throw new Exception("Chưa kết nối được workspace Muse. Hãy kiểm tra lại tài khoản và Internet.");
    }
    private void mark(String id,String state,String note) throws Exception {
        if(id==null||id.isEmpty())return;JSONObject account=store.find("accounts",id);if(account==null)return;
        if(state.equals("unknown")&&account.optString("status").equals("disconnected"))return;
        store.save("accounts",account.put("status",state).put("note",note).put("checkedAt",System.currentTimeMillis()));
    }
    JSONObject captureAccount(String label,String replaceId) throws Exception {
        ready(replaceId,20);
        CompletableFuture<String> cookies=new CompletableFuture<>();
        MainActivity.MAIN.post(()->{CookieManager.getInstance().flush();cookies.complete(CookieManager.getInstance().getCookie("https://muse.ai/"));});
        String header=cookies.get(10,TimeUnit.SECONDS);
        if(header==null||!header.contains("hatch_sess="))throw new Exception("Muse chưa xác nhận phiên đăng nhập. Hãy hoàn tất đăng nhập trước khi bấm Hoàn tất.");
        JSONObject account=replaceId!=null&&!replaceId.isEmpty()?store.required("accounts",replaceId):new JSONObject().put("id",UUID.randomUUID().toString());
        account.put("label",label.trim().isEmpty()?"Muse":label.trim().substring(0,Math.min(100,label.trim().length()))).put("encrypted",Secrets.encrypt(header));
        account.put("status","connected").put("checkedAt",System.currentTimeMillis()).remove("note");store.save("accounts",account);activeId=account.getString("id");
        JSONObject safe=new JSONObject(account.toString());safe.remove("encrypted");return safe;
    }
    private void prepare(String id) throws Exception {
        JSONObject account=store.required("accounts",id);
        if(!id.equals(activeId)) {
            String cookies=Secrets.decrypt(account.getString("encrypted"));CountDownLatch done=new CountDownLatch(1);
            MainActivity.MAIN.post(()->CookieManager.getInstance().removeAllCookies(value->{
                for(String pair:cookies.split(";\\s*"))if(pair.contains("="))CookieManager.getInstance().setCookie("https://muse.ai/",pair+"; Path=/; Secure");
                CookieManager.getInstance().flush();navigating=true;web.loadUrl("https://muse.ai/thread/new");done.countDown();
            }));done.await(15,TimeUnit.SECONDS);activeId=id;
        } else MainActivity.MAIN.post(()->{navigating=true;web.loadUrl("https://muse.ai/thread/new");});
        Thread.sleep(700);ready(id,75);mark(id,"connected","");
    }
    JSONObject checkAccount(String id) throws Exception {prepare(id);JSONObject value=store.required("accounts",id);value.remove("encrypted");return value;}
    private String account() throws Exception {
        JSONArray accounts=store.list("accounts");String disconnected=null;
        for(int i=0;i<accounts.length();i++) {JSONObject a=accounts.getJSONObject(i);if(a.optString("status").equals("disconnected")){disconnected=a.getString("id");continue;}return a.getString("id");}
        if(disconnected!=null)throw new Exception(DISCONNECTED);
        throw new Exception("Không thể tạo video vì chưa có tài khoản Muse được kết nối.");
    }
    String chat(String prompt) throws Exception {return run(prompt,"text",null).getString("text");}
    String media(String prompt,String kind,File reference) throws Exception {return run(prompt,kind,reference).getString("file");}
    private JSONObject run(String prompt,String kind,File reference) throws Exception {
        String id=account();prepare(id);
        String image="";
        if(reference!=null&&reference.isFile()){
            Bitmap bitmap=BitmapFactory.decodeFile(reference.getAbsolutePath());
            if(bitmap==null)throw new Exception("Không đọc được ảnh tham chiếu.");
            int max=Math.max(bitmap.getWidth(),bitmap.getHeight());
            if(max>1536){Bitmap resized=Bitmap.createScaledBitmap(bitmap,Math.max(1,bitmap.getWidth()*1536/max),Math.max(1,bitmap.getHeight()*1536/max),true);bitmap.recycle();bitmap=resized;}
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.JPEG,88,bytes);bitmap.recycle();
            image=android.util.Base64.encodeToString(bytes.toByteArray(),android.util.Base64.NO_WRAP);
        }
        Task current=new Task(UUID.randomUUID().toString(),kind);task=current;
        String script="("+taskScript+")("+JSONObject.quote(current.token)+","+JSONObject.quote(prompt)+","+JSONObject.quote(kind)+","+JSONObject.quote(image)+")";
        MainActivity.MAIN.post(()->web.evaluateJavascript(script,null));
        long deadline=System.currentTimeMillis()+(kind.equals("video")?900:kind.equals("image")?360:300)*1000L;
        try{
            while(!current.future.isDone()){
                if(JobService.cancelled()){cancel();throw new Exception("Đã dừng tác vụ.");}
                if(System.currentTimeMillis()>deadline)throw new Exception("Muse chưa hoàn tất trong thời gian chờ. Bạn có thể thử lại cảnh này.");
                Thread.sleep(250);
            }
            return current.future.get();
        }catch(Exception error){String message=JobService.friendly(error);if(message.contains("Muse bị mất kết nối"))mark(id,"disconnected",DISCONNECTED);throw new Exception(message);}
        finally{if(current.output!=null)try{current.output.close();}catch(Exception ignored){}task=null;}
    }
    void cancel(){MainActivity.MAIN.post(()->web.evaluateJavascript("window.__keyzoneCancelled=true;document.querySelector('[data-testid=hatch-composer-stop-button],button[aria-label*=Stop],button[aria-label*=停止]')?.click();",null));}
    static class Task {
        final String token,kind;final CompletableFuture<JSONObject> future=new CompletableFuture<>();
        FileOutputStream output;String file;long received;int chunk;
        Task(String token,String kind){this.token=token;this.kind=kind;}
    }
    final class ResultBridge {
        @JavascriptInterface public synchronized void message(String token,String raw){
            Task current=task;if(current==null||!current.token.equals(token)||current.future.isDone())return;
            try{
                JSONObject message=new JSONObject(raw);String type=message.getString("type");
                if(type.equals("error"))throw new Exception(message.optString("message","Muse chưa hoàn tất yêu cầu."));
                if(type.equals("text")&&current.kind.equals("text")){current.future.complete(new JSONObject().put("text",message.getString("text")));return;}
                if(type.equals("start")&&!current.kind.equals("text")){
                    if(current.output!=null)throw new Exception("Phản hồi media không hợp lệ.");
                    current.file=UUID.randomUUID().toString()+(current.kind.equals("video")?".mp4":message.optString("mime").contains("jpeg")?".jpg":".png");
                    current.output=new FileOutputStream(store.file(current.file));return;
                }
                if(type.equals("chunk")){
                    if(current.output==null||message.getInt("index")!=current.chunk++)throw new Exception("Dữ liệu media chưa toàn vẹn.");
                    String data=message.getString("data");if(data.length()>400000)throw new Exception("Gói media quá lớn.");
                    byte[] bytes=android.util.Base64.decode(data,android.util.Base64.DEFAULT);current.received+=bytes.length;
                    if(current.received>200L*1024*1024)throw new Exception("Media vượt quá giới hạn 200 MB.");current.output.write(bytes);return;
                }
                if(type.equals("end")){
                    if(current.output==null||current.received<100||current.received!=message.getLong("bytes"))throw new Exception("Muse chưa trả về file media hoàn chỉnh.");
                    current.output.close();current.output=null;current.future.complete(new JSONObject().put("file",current.file));
                }
            }catch(Exception error){current.future.completeExceptionally(error);}
        }
    }
}
