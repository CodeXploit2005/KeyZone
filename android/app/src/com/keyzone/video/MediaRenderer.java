package com.keyzone.video;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.media.MediaMetadataRetriever;
import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.ReturnCode;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

final class MediaRenderer {
    private final Store store;
    private final Context context;
    MediaRenderer(Context context) throws Exception {this.context=context;store=Store.get(context);}
    static void run(String... args) throws Exception {
        if(JobService.cancelled())throw new Exception("Đã dừng tác vụ.");
        FFmpegSession session=FFmpegKit.executeWithArguments(args);
        if(!ReturnCode.isSuccess(session.getReturnCode())&&!JobService.cancelled()){
            String[] fallback=args.clone();boolean hardware=false;for(int i=0;i<fallback.length;i++)if(fallback[i].equals("h264_mediacodec")){fallback[i]="libopenh264";hardware=true;}
            if(hardware)session=FFmpegKit.executeWithArguments(fallback);
        }
        if(!ReturnCode.isSuccess(session.getReturnCode())){
            if(JobService.cancelled()||ReturnCode.isCancel(session.getReturnCode()))throw new Exception("Đã dừng tác vụ.");
            throw new Exception("Chưa xuất được video trên thiết bị này. Hãy thử chất lượng 720p hoặc chạy Kiểm tra thiết bị trong Cài đặt.");
        }
    }
    static double duration(File file) throws Exception {
        MediaMetadataRetriever media=new MediaMetadataRetriever();
        try{media.setDataSource(file.getAbsolutePath());String value=media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);return Double.parseDouble(value)/1000.0;}
        finally{media.release();}
    }
    String lastFrame(String clip) throws Exception {
        String file=UUID.randomUUID()+".jpg";run("-y","-sseof","-0.08","-i",store.file(clip).getAbsolutePath(),"-frames:v","1",store.file(file).getAbsolutePath());return file;
    }
    String collage(JSONArray references) throws Exception {
        List<Bitmap> images=new ArrayList<>();
        for(int i=0;i<references.length()&&images.size()<4;i++){String key=references.optString(i);if(key.isEmpty())continue;Bitmap image=decode(store.file(key),1024);if(image!=null)images.add(image);}
        if(images.isEmpty())return null;
        int columns=images.size()==1?1:2;int rows=(images.size()+columns-1)/columns;int cell=768;
        Bitmap sheet=Bitmap.createBitmap(columns*cell,rows*cell,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(sheet);canvas.drawColor(Color.WHITE);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
        for(int i=0;i<images.size();i++){Bitmap image=images.get(i);float scale=Math.min((cell-32f)/image.getWidth(),(cell-32f)/image.getHeight());int w=(int)(image.getWidth()*scale),h=(int)(image.getHeight()*scale);int x=(i%columns)*cell+(cell-w)/2,y=(i/columns)*cell+(cell-h)/2;canvas.drawBitmap(image,null,new Rect(x,y,x+w,y+h),paint);image.recycle();}
        String file=UUID.randomUUID()+".jpg";try(FileOutputStream out=new FileOutputStream(store.file(file))){sheet.compress(Bitmap.CompressFormat.JPEG,90,out);}sheet.recycle();return file;
    }
    static Bitmap decode(File file,int limit){
        BitmapFactory.Options info=new BitmapFactory.Options();info.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getAbsolutePath(),info);
        int sample=1;while(Math.max(info.outWidth,info.outHeight)/sample>limit)sample*=2;
        BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=sample;return BitmapFactory.decodeFile(file.getAbsolutePath(),options);
    }
    String render(JSONObject project,JSONObject niche) throws Exception {
        JSONArray scenes=project.getJSONArray("scenes");if(scenes.length()==0)throw new Exception("Dự án chưa có cảnh.");
        File temporary=new File(context.getCacheDir(),"render-"+project.getString("id"));temporary.mkdirs();
        int height=project.optInt("quality",1080)==720?1280:1920;int width=height*9/16;
        if(project.optString("aspectRatio").equals("16:9")){int old=width;width=height;height=old;}
        String scale="scale="+width+":"+height+":force_original_aspect_ratio=increase,crop="+width+":"+height+",setsar=1,fps=30";
        boolean narration=niche.optString("format","story").equals("story")&&!project.optString("scriptSource").equals("imported-wordless");
        JSONObject settings=store.settings();List<File> prepared=new ArrayList<>();
        for(int i=0;i<scenes.length();i++){
            JSONObject scene=scenes.getJSONObject(i);File source=store.file(scene.getString("clipFile"));if(!source.isFile())throw new Exception("Cảnh "+(i+1)+" chưa có video.");
            JobService.update("Đang dựng cảnh "+(i+1)+"/"+scenes.length(),project.getString("id"));
            double seconds=duration(source);String filter=scale;
            if(narration&&!scene.optString("narration").trim().isEmpty()){
                File srt=new File(temporary,"caption-"+i+".srt");
                String caption="1\n00:00:00,000 --> "+stamp(seconds)+"\n"+wrap(scene.optString("narration"),45)+"\n";Files.write(srt.toPath(),caption.getBytes(StandardCharsets.UTF_8));
                File fonts=new File(context.getFilesDir(),"fonts");fonts.mkdirs();File font=new File(fonts,"Montserrat-Bold.ttf");
                if(!font.exists())try(InputStream input=context.getAssets().open("fonts/Montserrat-Bold.ttf");FileOutputStream output=new FileOutputStream(font)){byte[] b=new byte[8192];int n;while((n=input.read(b))!=-1)output.write(b,0,n);}
                filter+=",subtitles="+srt.getAbsolutePath()+":fontsdir="+fonts.getAbsolutePath()+":force_style='FontName=Montserrat,FontSize=20,Outline=2,MarginV=45'";
            }
            File output=new File(temporary,"clip-"+i+".mp4");
            ArrayList<String> args=new ArrayList<>(Arrays.asList("-y","-i",source.getAbsolutePath()));
            String voice=narration?niche.optString("narratorVoiceId"):"";
            if(!voice.isEmpty()&&!voice.equals("null")){
                String key=settings.optString("ELEVENLABS_API_KEY");if(key.isEmpty())throw new Exception("Ngách này dùng giọng đọc ElevenLabs. Hãy thêm khóa API của bạn hoặc tắt giọng đọc trong ngách.");
                if(!voice.matches("[A-Za-z0-9_-]{1,100}"))throw new Exception("Mã giọng đọc không hợp lệ.");
                HashMap<String,String> headers=new HashMap<>();headers.put("xi-api-key",key);headers.put("Accept","audio/mpeg");
                byte[] bytes=Http.post("https://api.elevenlabs.io/v1/text-to-speech/"+voice,new JSONObject().put("text",scene.optString("narration")).put("model_id",settings.optString("ELEVENLABS_MODEL","eleven_multilingual_v2")),headers);
                File audio=new File(temporary,"voice-"+i+".mp3");Files.write(audio.toPath(),bytes);seconds=Math.max(seconds,duration(audio));
                args.addAll(Arrays.asList("-i",audio.getAbsolutePath(),"-map","0:v:0","-map","1:a:0","-af","apad","-c:a","aac","-b:a","192k"));filter+=",tpad=stop_mode=clone:stop_duration="+seconds;
            }else{
                args.addAll(Arrays.asList("-f","lavfi","-i","anullsrc=r=48000:cl=stereo","-map","0:v:0","-map","1:a:0","-c:a","aac","-b:a","128k"));
            }
            args.addAll(Arrays.asList("-vf",filter,"-t",String.format(Locale.US,"%.3f",seconds),"-c:v","h264_mediacodec","-b:v","6000000","-pix_fmt","yuv420p","-ar","48000","-ac","2","-movflags","+faststart",output.getAbsolutePath()));
            run(args.toArray(new String[0]));prepared.add(output);
        }
        File list=new File(temporary,"clips.txt");StringBuilder lines=new StringBuilder();for(File file:prepared)lines.append("file '").append(file.getAbsolutePath()).append("'\n");Files.write(list.toPath(),lines.toString().getBytes(StandardCharsets.UTF_8));
        String file=project.getString("id")+".mp4";File joined=new File(temporary,"joined.mp4");
        run("-y","-f","concat","-safe","0","-i",list.getAbsolutePath(),"-c","copy","-movflags","+faststart",joined.getAbsolutePath());
        String music=project.optString("audioFile");
        if(!music.isEmpty()){
            File audio=store.file(music);double audioSeconds=duration(audio);
            if(niche.optString("format").equals("ambient"))run("-y","-stream_loop","-1","-i",joined.getAbsolutePath(),"-i",audio.getAbsolutePath(),"-map","0:v:0","-map","1:a:0","-t",String.valueOf(audioSeconds),"-c:v","copy","-c:a","aac","-movflags","+faststart",store.file(file).getAbsolutePath());
            else run("-y","-i",joined.getAbsolutePath(),"-stream_loop","-1","-i",audio.getAbsolutePath(),"-filter_complex","[1:a]volume=0.15[m];[0:a][m]amix=inputs=2:duration=first[a]","-map","0:v:0","-map","[a]","-c:v","copy","-c:a","aac","-shortest","-movflags","+faststart",store.file(file).getAbsolutePath());
        }else Files.copy(joined.toPath(),store.file(file).toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        return file;
    }
    String thumbnail(JSONObject project,String background,String headline) throws Exception {
        boolean vertical=project.optString("aspectRatio").equals("9:16");int width=vertical?720:1280,height=vertical?1280:720;
        Bitmap output=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(output);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
        Bitmap base=decode(store.file(background),1600);if(base==null)throw new Exception("Chưa có ảnh nền thumbnail.");
        float factor=Math.max((float)width/base.getWidth(),(float)height/base.getHeight());int w=(int)(base.getWidth()*factor),h=(int)(base.getHeight()*factor);canvas.drawBitmap(base,null,new Rect((width-w)/2,(height-h)/2,(width+w)/2,(height+h)/2),paint);base.recycle();
        paint.setShader(new LinearGradient(0,height*0.25f,0,height,0x00000000,0xdd11111b,Shader.TileMode.CLAMP));canvas.drawRect(0,0,width,height,paint);paint.setShader(null);
        paint.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));paint.setTextSize(vertical?70:90);paint.setColor(Color.WHITE);paint.setShadowLayer(8,0,4,Color.BLACK);
        String[] words=headline.replace("*","").toUpperCase(Locale.ROOT).split("\\s+");StringBuilder line=new StringBuilder();List<String> text=new ArrayList<>();
        for(String word:words){String candidate=line.length()==0?word:line+" "+word;if(paint.measureText(candidate)>width-90&&line.length()>0){text.add(line.toString());line.setLength(0);}if(line.length()>0)line.append(' ');line.append(word);}if(line.length()>0)text.add(line.toString());
        float y=height-80-(Math.min(text.size(),4)-1)*paint.getTextSize()*1.15f;
        for(int i=0;i<Math.min(text.size(),4);i++){canvas.drawText(text.get(i),45,y,paint);y+=paint.getTextSize()*1.15f;}
        String name=UUID.randomUUID()+".jpg";try(FileOutputStream stream=new FileOutputStream(store.file(name))){output.compress(Bitmap.CompressFormat.JPEG,90,stream);}output.recycle();return name;
    }
    String selfTest() throws Exception {
        String name="device-test.mp4";
        run("-y","-f","lavfi","-i","color=c=0x9175ff:s=360x640:d=1","-c:v","h264_mediacodec","-b:v","1000000","-pix_fmt","yuv420p",store.file(name).getAbsolutePath());
        if(duration(store.file(name))<0.9)throw new Exception("Thiết bị chưa xuất được video thử nghiệm.");return name;
    }
    private static String stamp(double seconds){long ms=(long)(seconds*1000);return String.format(Locale.US,"%02d:%02d:%02d,%03d",ms/3600000,(ms/60000)%60,(ms/1000)%60,ms%1000);}
    private static String wrap(String text,int limit){StringBuilder result=new StringBuilder();int count=0;for(String word:text.replaceAll("[\\r\\n]+"," ").split("\\s+")){if(count+word.length()>limit){result.append('\n');count=0;}else if(count>0){result.append(' ');count++;}result.append(word);count+=word.length();}return result.toString();}
}
