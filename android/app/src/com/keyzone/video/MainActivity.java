package com.keyzone.video;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class MainActivity extends Activity {
    static MainActivity current;
    static final Handler MAIN = new Handler(Looper.getMainLooper());
    private WebView appView;
    private FrameLayout root;
    private LinearLayout loginOverlay;
    private String pickerTag;
    private Store store;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state); current = this;
        getWindow().setStatusBarColor(Color.rgb(17,18,27)); getWindow().setNavigationBarColor(Color.rgb(17,18,27));
        try {
            store = Store.get(this);
            if (!JobService.busy()) {
                JSONArray projects = store.list("projects");
                for (int i=0;i<projects.length();i++) {
                    JSONObject p = projects.getJSONObject(i);
                    if (p.optString("status").matches("scripting|producing|rendering")) store.save("projects",p.put("status","failed").put("error","Tác vụ bị gián đoạn. Bạn có thể thử lại."));
                }
            }
            root = new FrameLayout(this); appView = new WebView(this);
            if(Build.VERSION.SDK_INT>=30){getWindow().setDecorFitsSystemWindows(false);root.setOnApplyWindowInsetsListener((view,insets)->{android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.displayCutout());root.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});}else root.setFitsSystemWindows(true);
            configure(appView); appView.addJavascriptInterface(new Bridge(), "KeyZoneNative");
            appView.setWebChromeClient(new WebChromeClient(){
                @Override public boolean onJsConfirm(WebView view,String url,String message,android.webkit.JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Tiếp tục",(d,w)->result.confirm()).setNegativeButton("Hủy",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
                @Override public boolean onJsAlert(WebView view,String url,String message,android.webkit.JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Đóng",(d,w)->result.confirm()).show();return true;}
            });
            appView.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    if ("https".equals(uri.getScheme()) && "keyzone.local".equals(uri.getHost())) return false;
                    if ("https".equals(uri.getScheme())) startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    if (!"https".equals(uri.getScheme()) || !"keyzone.local".equals(uri.getHost())) return empty();
                    try {
                        String name = uri.getPath();
                        if (name.startsWith("/files/")) {
                            License.get(MainActivity.this).requireValid(false);
                            File file = store.file(name.substring(7));
                            String mime = name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".mp3") ? "audio/mpeg" : name.endsWith(".m4a") ? "audio/mp4" : name.endsWith(".txt") ? "text/plain" : name.endsWith(".png") ? "image/png" : "image/jpeg";
                            long length=file.length(),start=0,end=Math.max(0,length-1);String range=request.getRequestHeaders().get("Range");boolean partial=false;
                            if(range!=null&&range.startsWith("bytes=")){String[] limits=range.substring(6).split("-",-1);if(!limits[0].isEmpty())start=Long.parseLong(limits[0]);else start=Math.max(0,length-Long.parseLong(limits[1]));if(limits.length>1&&!limits[1].isEmpty()&&!limits[0].isEmpty())end=Math.min(end,Long.parseLong(limits[1]));partial=true;}
                            if(start<0||start>=length||end<start)return empty();
                            FileInputStream source=new FileInputStream(file);long skipped=0;while(skipped<start){long n=source.skip(start-skipped);if(n<=0)break;skipped+=n;}
                            final long count=end-start+1;java.io.InputStream bounded=new java.io.FilterInputStream(source){long remaining=count;@Override public int read()throws java.io.IOException{if(remaining<=0)return -1;int v=super.read();if(v>=0)remaining--;return v;}@Override public int read(byte[] b,int off,int len)throws java.io.IOException{if(remaining<=0)return -1;int n=in.read(b,off,(int)Math.min(len,remaining));if(n>0)remaining-=n;return n;}};
                            java.util.HashMap<String,String> headers=new java.util.HashMap<>();headers.put("Accept-Ranges","bytes");headers.put("Content-Length",String.valueOf(count));if(partial)headers.put("Content-Range","bytes "+start+"-"+end+"/"+length);
                            return new WebResourceResponse(mime,null,partial?206:200,partial?"Partial Content":"OK",headers,bounded);
                        }
                        if (name.equals("/") || name.isEmpty()) name = "/index.html";
                        if (!name.matches("/[A-Za-z0-9_.-]+") || name.contains("..")) return empty();
                        String mime = name.endsWith(".js") ? "application/javascript" : name.endsWith(".css") ? "text/css" : name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".png") ? "image/png" : "text/html";
                        return new WebResourceResponse(mime, name.endsWith(".png") ? null : "UTF-8", getAssets().open(name.substring(1)));
                    } catch (Exception error) { return empty(); }
                }
            });
            root.addView(appView, new FrameLayout.LayoutParams(-1,-1)); setContentView(root);
            appView.loadUrl("https://keyzone.local/");
            MuseEngine.get(getApplicationContext());
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS},33);
        } catch (Exception error) { new AlertDialog.Builder(this).setTitle("Chưa mở được KeyZone").setMessage(error.getMessage()).setPositiveButton("Đóng",(d,w)->finish()).show(); }
    }
    static void configure(WebView view) {
        WebSettings settings = view.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false); view.setBackgroundColor(Color.rgb(17,18,27));
        WebView.setWebContentsDebuggingEnabled(false);
    }
    private static WebResourceResponse empty() { return new WebResourceResponse("text/plain","UTF-8",404,"Not found",null,new ByteArrayInputStream(new byte[0])); }
    static String readAsset(Context context, String name) throws Exception {
        try (InputStream input = context.getAssets().open(name); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer=new byte[8192]; int n; while ((n=input.read(buffer))!=-1) output.write(buffer,0,n);
            return output.toString("UTF-8");
        }
    }
    static void event(String name, JSONObject data) {
        MAIN.post(() -> { if (current != null && current.appView != null) current.appView.evaluateJavascript("window.dispatchEvent(new CustomEvent("+JSONObject.quote(name)+",{detail:"+data.toString()+"}));",null); });
    }
    private void showMuse(String replaceId) {
        if (JobService.busy()) { Toast.makeText(this,"Hãy chờ tác vụ hiện tại hoàn tất hoặc dừng tác vụ.",Toast.LENGTH_LONG).show(); return; }
        try {
            MuseEngine engine=MuseEngine.get(this);
            if (engine.view().getParent()!=null) ((android.view.ViewGroup)engine.view().getParent()).removeView(engine.view());
            loginOverlay=new LinearLayout(this); loginOverlay.setOrientation(LinearLayout.VERTICAL); loginOverlay.setBackgroundColor(Color.rgb(17,18,27));
            LinearLayout bar=new LinearLayout(this); bar.setPadding(8,8,8,8);
            Button close=new Button(this); close.setText("Đóng");
            EditText label=new EditText(this); label.setSingleLine(true); label.setHint("Tên tài khoản"); label.setTextColor(Color.WHITE); label.setText("Muse");
            Button finish=new Button(this); finish.setText("Hoàn tất");
            bar.addView(close); bar.addView(label,new LinearLayout.LayoutParams(0,-2,1)); bar.addView(finish);
            loginOverlay.addView(bar); loginOverlay.addView(engine.view(),new LinearLayout.LayoutParams(-1,0,1));
            root.addView(loginOverlay,new FrameLayout.LayoutParams(-1,-1));
            close.setOnClickListener(v->closeMuse());
            finish.setOnClickListener(v->{ finish.setEnabled(false);String accountLabel=label.getText().toString(); new Thread(()->{
                try { engine.captureAccount(accountLabel,replaceId); MAIN.post(()->{ closeMuse(); event("keyzone-changed",new JSONObject()); }); }
                catch(Exception error) { MAIN.post(()->{finish.setEnabled(true);new AlertDialog.Builder(this).setMessage(error.getMessage()).setPositiveButton("Đóng",null).show();}); }
            }).start(); });
            engine.login();
        } catch(Exception error) { Toast.makeText(this,error.getMessage(),Toast.LENGTH_LONG).show(); }
    }
    private void closeMuse() {
        if (loginOverlay!=null) { root.removeView(loginOverlay); loginOverlay.removeAllViews(); loginOverlay=null; }
    }
    @Override public void onBackPressed() {
        if(loginOverlay!=null) { closeMuse(); return; }
        appView.evaluateJavascript("window.keyzoneBack&&window.keyzoneBack()",null);
    }
    @Override protected void onDestroy() { if(current==this)current=null;super.onDestroy(); }

    final class Bridge {
        @JavascriptInterface public String request(String raw) {
            try {
                JSONObject request=new JSONObject(raw); String action=request.getString("action"); JSONObject data=request.optJSONObject("data"); if(data==null)data=new JSONObject();
                Object result=dispatch(action,data);
                return new JSONObject().put("ok",true).put("data",result==null?JSONObject.NULL:result).toString();
            } catch(Exception error) { try { return new JSONObject().put("ok",false).put("error",JobService.friendly(error)).put("code",error instanceof LicenseGate.Denied?"LICENSE_REQUIRED":"ERROR").toString(); } catch(Exception ignored) { return "{\"ok\":false,\"error\":\"Thao tác chưa thành công.\"}"; } }
        }
        private Object dispatch(String action, JSONObject data) throws Exception {
            LicenseGate license=License.get(MainActivity.this);
            if(action.equals("license.status"))return License.publicState(license.status(data.optBoolean("force")));
            if(action.equals("license.activate"))return License.publicState(license.activate(data.optString("key")));
            if(action.equals("license.deactivate")) {
                if(JobService.busy())throw new Exception("Hãy dừng tác vụ trước khi gỡ kích hoạt.");
                license.deactivate();return null;
            }
            if(action.equals("snapshot")) {
                LicenseGate.Reply state=license.status(false);
                if(!state.valid&&JobService.busy())JobService.cancel();
                return (state.valid?store.snapshot():new JSONObject()).put("license",License.publicState(state));
            }
            if(action.equals("app.background")){MAIN.post(()->moveTaskToBack(true));return null;}
            if(action.equals("job.cancel")) { JobService.cancel();return null; }
            license.requireValid(false);
            if(action.equals("clipboard")){String text=data.optString("text");MAIN.post(()->((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(android.content.ClipData.newPlainText("KeyZone",text)));return null;}
            if(action.equals("muse.login")) { String replace=data.optString("id");MAIN.post(()->showMuse(replace));return null; }
            if(action.equals("muse.check")) {
                if(JobService.busy())throw new Exception("Hãy chờ tác vụ hiện tại hoàn tất.");
                return MuseEngine.get(MainActivity.this).checkAccount(data.getString("id"));
            }
            if(action.equals("job.start")) { JobService.enqueue(MainActivity.this,data.getString("kind"),data.getString("id"));return null; }
            if(action.equals("file.pick")) { pickerTag=data.optString("tag");String mime=data.optString("mime","image/*");MAIN.post(()->{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.setType(mime);intent.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,71);});return null; }
            if(action.equals("settings.save")) { store.saveSettings(data);return null; }
            if(action.equals("project.save")) {
                if(JobService.busy())throw new Exception("Hãy dừng tác vụ trước khi sửa dự án.");
                JSONObject project=data.has("id")?store.required("projects",data.getString("id")):new JSONObject().put("id",UUID.randomUUID().toString()).put("status","draft").put("scenes",new JSONArray()).put("scriptSource","generated");
                JSONArray oldScenes=project.optJSONArray("scenes");
                for(String key:new String[]{"title","topic","nicheId","aspectRatio","referenceFile","audioFile","scriptSource","characterIds","scenes","sceneCount","quality","thumbnailHeadline"}) if(data.has(key))project.put(key,data.get(key));
                if(project.optString("title").trim().isEmpty()||project.optString("title").length()>150)throw new Exception("Hãy nhập tên video hợp lệ.");
                store.required("niches",project.getString("nicheId"));
                if(!project.optString("aspectRatio").matches("9:16|16:9"))throw new Exception("Tỷ lệ video không hợp lệ.");
                if(data.has("scenes")) {
                    JSONArray fresh=project.getJSONArray("scenes");validateScenes(fresh);
                    if(oldScenes!=null)for(int i=0;i<fresh.length();i++){JSONObject scene=fresh.getJSONObject(i),old=null;for(int j=0;j<oldScenes.length();j++)if(scene.optString("id").equals(oldScenes.getJSONObject(j).optString("id")))old=oldScenes.getJSONObject(j);if(old!=null&&(!old.optString("visualPrompt").equals(scene.optString("visualPrompt"))||!old.optString("camera").equals(scene.optString("camera"))||old.optBoolean("continuesPrevious")!=scene.optBoolean("continuesPrevious"))){scene.remove("imageFile");scene.remove("clipFile");scene.remove("error");scene.put("status","pending");}}
                    project.put("status","script_ready");project.remove("error");project.remove("videoFile");
                }
                return store.save("projects",project);
            }
            if(action.equals("scene.reset")){
                if(JobService.busy())throw new Exception("Hãy chờ tác vụ hiện tại hoàn tất.");JSONObject project=store.required("projects",data.getString("id"));JSONObject scene=project.getJSONArray("scenes").getJSONObject(data.getInt("index"));scene.remove("imageFile");scene.remove("clipFile");scene.remove("error");scene.put("status","pending");project.put("status","script_ready");project.remove("videoFile");project.remove("error");return store.save("projects",project);
            }
            if(action.equals("niche.save")) {
                if(data.optString("name").trim().isEmpty())throw new Exception("Hãy nhập tên ngách.");
                data.put("sceneCount",Math.max(1,Math.min(40,data.optInt("sceneCount",6))));data.put("sceneSeconds",Math.max(4,Math.min(10,data.optInt("sceneSeconds",8))));
                if(!data.optString("format").matches("story|ambient|wordless"))data.put("format","story");
                return store.save("niches",data);
            }
            if(action.equals("character.save")) { if(data.optString("name").trim().isEmpty())throw new Exception("Hãy nhập tên nhân vật.");return store.save("characters",data); }
            if(action.equals("delete")) {
                if(JobService.busy())throw new Exception("Hãy chờ hoặc dừng tác vụ hiện tại.");
                String kind=data.getString("kind");if(!kind.matches("projects|characters|accounts|niches"))throw new Exception("Mục không hợp lệ.");
                if(kind.equals("niches")) { JSONArray projects=store.list("projects");for(int i=0;i<projects.length();i++)if(data.getString("id").equals(projects.getJSONObject(i).optString("nicheId")))throw new Exception("Ngách này đang được dùng trong một dự án."); }
                store.delete(kind,data.getString("id"));return null;
            }
            if(action.equals("export"))return export(data.getString("file"),data.optString("title","KeyZone"),data.optBoolean("share"));
            throw new Exception("Thao tác chưa được hỗ trợ.");
        }
    }
    static void validateScenes(JSONArray scenes) throws Exception {
        if(scenes.length()<1||scenes.length()>40)throw new Exception("Kịch bản cần từ 1 đến 40 cảnh.");
        for(int i=0;i<scenes.length();i++) {
            JSONObject scene=scenes.getJSONObject(i); if(scene.optString("visualPrompt").trim().isEmpty())throw new Exception("Cảnh "+(i+1)+" cần prompt hình ảnh.");
            if(!scene.has("id"))scene.put("id",UUID.randomUUID().toString());if(!scene.has("status"))scene.put("status","pending");
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent intent) {
        super.onActivityResult(request,result,intent);if(request!=71||result!=RESULT_OK||intent==null)return;
        Uri uri=intent.getData();String tag=pickerTag;
        new Thread(()->{try {
            String mime=getContentResolver().getType(uri);String ext=mime!=null&&mime.startsWith("audio/")?mime.contains("mpeg")?".mp3":".m4a":mime!=null&&mime.startsWith("video/")?".mp4":mime!=null&&mime.contains("png")?".png":".jpg";
            String name=UUID.randomUUID().toString()+ext;
            try(InputStream input=getContentResolver().openInputStream(uri);OutputStream output=new FileOutputStream(store.file(name))) {
                byte[] buffer=new byte[65536];long total=0;int n;while((n=input.read(buffer))!=-1){total+=n;if(total>200L*1024*1024)throw new Exception("File vượt quá 200 MB.");output.write(buffer,0,n);}
            }
            event("keyzone-file",new JSONObject().put("tag",tag).put("file",name).put("mime",mime));
        }catch(Exception error){MAIN.post(()->Toast.makeText(this,error.getMessage(),Toast.LENGTH_LONG).show());}}).start();
    }
    private String export(String name,String title,boolean share) throws Exception {
        File source=store.file(name);if(!source.isFile())throw new Exception("Không tìm thấy file đã tạo.");
        boolean video=name.endsWith(".mp4");String mime=video?"video/mp4":"image/jpeg";
        String filename=title.replaceAll("[^\\p{L}\\p{N} _-]","");if(filename.length()>80)filename=filename.substring(0,80);if(filename.isEmpty())filename="KeyZone";
        ContentValues values=new ContentValues();values.put(MediaStore.MediaColumns.DISPLAY_NAME,filename+(video?".mp4":".jpg"));values.put(MediaStore.MediaColumns.MIME_TYPE,mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH,(video?"Movies":"Pictures")+"/KeyZone");values.put(MediaStore.MediaColumns.IS_PENDING,1);
        Uri uri=getContentResolver().insert(video?MediaStore.Video.Media.EXTERNAL_CONTENT_URI:MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values);
        if(uri==null)throw new Exception("Chưa tạo được file trong thư viện.");
        try(InputStream input=new FileInputStream(source);OutputStream output=getContentResolver().openOutputStream(uri)){byte[] b=new byte[65536];int n;while((n=input.read(b))!=-1)output.write(b,0,n);}
        values.clear();values.put(MediaStore.MediaColumns.IS_PENDING,0);getContentResolver().update(uri,values,null,null);
        if(share)MAIN.post(()->{Intent send=new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(send,"Chia sẻ từ KeyZone"));});
        return uri.toString();
    }
}
