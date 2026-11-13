package com.keyzone.video;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;

final class License {
    private static LicenseGate instance;
    static synchronized LicenseGate get(Context context) {
        if(instance==null) {
            final SharedPreferences prefs=context.getApplicationContext().getSharedPreferences("keyzone-license",Context.MODE_PRIVATE);
            instance=new LicenseGate(new LicenseGate.Storage() {
                public String device() throws Exception {
                    String value=prefs.getString("device","");
                    if(!value.matches("[a-f0-9]{64}")) {
                        byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);StringBuilder hex=new StringBuilder();
                        for(byte b:bytes)hex.append(String.format(java.util.Locale.ROOT,"%02x",b&255));value=hex.toString();
                        if(!prefs.edit().putString("device",value).commit())throw new Exception("Không lưu được mã thiết bị.");
                    }
                    return value;
                }
                public String token() throws Exception { String value=prefs.getString("session","");return value.isEmpty()?"":Secrets.decrypt(value); }
                public void token(String value) throws Exception {
                    SharedPreferences.Editor edit=prefs.edit();
                    if(value.isEmpty())edit.remove("session");else edit.putString("session",Secrets.encrypt(value));
                    if(!edit.commit())throw new Exception("Không lưu được phiên kích hoạt.");
                }
            },License::request,new LicenseGate.Clock() {
                public long elapsed(){return SystemClock.elapsedRealtime();}
                public long now(){return System.currentTimeMillis();}
            });
        }
        return instance;
    }
    static JSONObject publicState(LicenseGate.Reply reply) throws Exception {
        return new JSONObject().put("valid",reply.valid).put("error",reply.error).put("customer",reply.customer).put("expiresAt",reply.expiresAt);
    }
    private static LicenseGate.Reply request(String action,String device,String credential) throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL("https://keyzone-6laz.onrender.com/v1/"+action).openConnection();
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(12000);connection.setReadTimeout(15000);
        connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
        try {
            byte[] bytes=new JSONObject().put("device",device).put(action.equals("activate")?"key":"token",credential).toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try(OutputStream output=connection.getOutputStream()){output.write(bytes);}
            int code=connection.getResponseCode();
            InputStream stream=code>=200&&code<300?connection.getInputStream():connection.getErrorStream();
            if(stream==null)throw new Exception("Máy chủ chưa phản hồi.");
            JSONObject body;
            try(InputStream input=stream;ByteArrayOutputStream output=new ByteArrayOutputStream()) {
                byte[] buffer=new byte[2048];int n;
                while((n=input.read(buffer))!=-1){output.write(buffer,0,n);if(output.size()>16384)throw new Exception("Phản hồi không hợp lệ.");}
                body=new JSONObject(output.toString("UTF-8"));
            }
            if(code<200||code>=300) {
                if(action.equals("deactivate"))throw new Exception(body.optString("error","Chưa gỡ được kích hoạt."));
                return LicenseGate.Reply.denied(body.optString("error","Máy chủ chưa chấp nhận yêu cầu."));
            }
            if(action.equals("deactivate")) {
                if(!body.optBoolean("ok"))throw new Exception("Chưa gỡ được kích hoạt.");
                return LicenseGate.Reply.denied("");
            }
            if(!body.optBoolean("valid"))return LicenseGate.Reply.denied(body.optString("error","Key không hợp lệ."));
            String expiresAt=body.getString("expiresAt");
            return new LicenseGate.Reply(true,"",body.optString("customer"),expiresAt,Instant.parse(expiresAt).toEpochMilli(),body.optString("token"));
        } finally { connection.disconnect(); }
    }
}
