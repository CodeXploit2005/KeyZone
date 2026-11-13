package com.keyzone.video;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

final class Store {
    private static Store instance;
    final Context context;
    private final SQLiteDatabase database;
    static synchronized Store get(Context context) throws Exception {
        if (instance == null) instance = new Store(context.getApplicationContext());
        return instance;
    }
    private Store(Context context) throws Exception {
        this.context = context;
        database = context.openOrCreateDatabase("keyzone.sqlite", Context.MODE_PRIVATE, null);
        database.execSQL("CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(kind,id))");
        new File(context.getFilesDir(), "media").mkdirs();
        if (find("meta", "seed") == null) {
            JSONArray defaults = new JSONArray(MainActivity.readAsset(context, "default-niches.json"));
            for (int i = 0; i < defaults.length(); i++) {
                JSONObject item = defaults.getJSONObject(i);
                item.put("id", UUID.nameUUIDFromBytes(item.getString("slug").getBytes(StandardCharsets.UTF_8)).toString());
                save("niches", item);
            }
            save("meta", new JSONObject().put("id", "seed").put("version", 1));
        }
    }
    synchronized JSONObject find(String kind, String id) throws Exception {
        try (Cursor cursor = database.rawQuery("SELECT json FROM records WHERE kind=? AND id=?", new String[] {kind,id})) {
            return cursor.moveToFirst() ? new JSONObject(cursor.getString(0)) : null;
        }
    }
    synchronized JSONArray list(String kind) throws Exception {
        JSONArray result = new JSONArray();
        try (Cursor cursor = database.rawQuery("SELECT json FROM records WHERE kind=? ORDER BY updated DESC", new String[] {kind})) {
            while (cursor.moveToNext()) result.put(new JSONObject(cursor.getString(0)));
        }
        return result;
    }
    synchronized JSONObject save(String kind, JSONObject item) throws Exception {
        if (!item.has("id")) item.put("id", UUID.randomUUID().toString());
        item.put("updatedAt", System.currentTimeMillis());
        ContentValues row = new ContentValues(); row.put("kind",kind); row.put("id",item.getString("id"));
        row.put("json",item.toString()); row.put("updated",System.currentTimeMillis());
        database.insertWithOnConflict("records", null, row, SQLiteDatabase.CONFLICT_REPLACE);
        return item;
    }
    synchronized void delete(String kind, String id) {
        database.delete("records", "kind=? AND id=?", new String[] {kind,id});
    }
    JSONObject required(String kind, String id) throws Exception {
        JSONObject value = find(kind,id); if (value == null) throw new Exception("Mục này không còn tồn tại."); return value;
    }
    File file(String name) throws Exception {
        if (name == null || !name.matches("[A-Za-z0-9_.-]{1,180}") || name.contains("..")) throw new Exception("Tên file không hợp lệ.");
        return new File(new File(context.getFilesDir(), "media"), name);
    }
    JSONObject settings() throws Exception {
        JSONObject row = find("meta", "settings");
        return row == null ? new JSONObject() : new JSONObject(Secrets.decrypt(row.getString("encrypted")));
    }
    void saveSettings(JSONObject update) throws Exception {
        JSONObject value = settings();
        for (String key : new String[] {"ELEVENLABS_API_KEY","ELEVENLABS_MODEL","CF_AIG_BASE_URL","CF_AIG_TOKEN","SCRIPT_MODEL","FACEBOOK_PAGE_ID","FACEBOOK_TOKEN","INSTAGRAM_ID"}) {
            if (update.has(key)) value.put(key,update.optString(key).trim());
        }
        save("meta",new JSONObject().put("id","settings").put("encrypted",Secrets.encrypt(value.toString())));
    }
    synchronized JSONObject snapshot() throws Exception {
        JSONArray accounts = list("accounts");
        for (int i=0;i<accounts.length();i++) accounts.getJSONObject(i).remove("encrypted");
        JSONObject settings = settings();
        JSONObject publicSettings = new JSONObject();
        for (String key : new String[] {"ELEVENLABS_API_KEY","CF_AIG_TOKEN","FACEBOOK_TOKEN"}) publicSettings.put(key, !settings.optString(key).isEmpty());
        for (String key : new String[] {"ELEVENLABS_MODEL","CF_AIG_BASE_URL","SCRIPT_MODEL","FACEBOOK_PAGE_ID","INSTAGRAM_ID"}) publicSettings.put(key, settings.optString(key));
        return new JSONObject().put("projects",list("projects")).put("characters",list("characters"))
            .put("niches",list("niches")).put("accounts",accounts).put("settings",publicSettings)
            .put("busy",JobService.busy()).put("job",JobService.progress());
    }
}
