package com.keyzone.video;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;

final class Http {
    static byte[] post(String address,JSONObject body,Map<String,String> headers) throws Exception {
        URL url=new URL(address);if(!url.getProtocol().equals("https"))throw new Exception("Dịch vụ phải sử dụng kết nối HTTPS.");
        HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(20000);connection.setReadTimeout(240000);connection.setRequestMethod("POST");connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type","application/json");
        for(Map.Entry<String,String> header:headers.entrySet())connection.setRequestProperty(header.getKey(),header.getValue());
        try {
            byte[] request=body.toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(request.length);
            try(OutputStream stream=connection.getOutputStream()){stream.write(request);}
            int code=connection.getResponseCode();if(code<200||code>=300)throw new Exception("Dịch vụ chưa chấp nhận yêu cầu (HTTP "+code+"). Kiểm tra khóa API hoặc hạn mức tài khoản.");
            try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){
                byte[] buffer=new byte[65536];int n;while((n=input.read(buffer))!=-1){if(JobService.cancelled())throw new Exception("Đã dừng tác vụ.");output.write(buffer,0,n);if(output.size()>100*1024*1024)throw new Exception("Phản hồi vượt quá giới hạn dung lượng.");}return output.toByteArray();
            }
        }finally{connection.disconnect();}
    }
}
