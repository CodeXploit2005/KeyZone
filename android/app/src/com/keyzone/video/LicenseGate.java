package com.keyzone.video;

/** License policy shared by the Android bridge and background jobs. No persisted offline grant. */
final class LicenseGate {
    interface Storage {
        String device() throws Exception;
        String token() throws Exception;
        void token(String value) throws Exception;
    }
    interface Remote { Reply request(String action, String device, String credential) throws Exception; }
    interface Clock { long elapsed(); long now(); }
    static final class Reply {
        final boolean valid;
        final String error, customer, expiresAt, token;
        final long expires;
        Reply(boolean valid, String error, String customer, String expiresAt, long expires, String token) {
            this.valid=valid;this.error=error;this.customer=customer;this.expiresAt=expiresAt;this.expires=expires;this.token=token;
        }
        static Reply denied(String message) { return new Reply(false,message,"","",0,""); }
    }
    static final class Denied extends Exception { Denied(String message) { super(message); } }
    private final Storage storage;
    private final Remote remote;
    private final Clock clock;
    private Reply state=Reply.denied("Nhập key để kích hoạt KeyZone trên điện thoại.");
    private long checked=-1;
    LicenseGate(Storage storage, Remote remote, Clock clock) { this.storage=storage;this.remote=remote;this.clock=clock; }
    synchronized Reply status(boolean force) {
        long age=clock.elapsed()-checked;
        if(!force&&checked>=0&&age>=0&&age<30000&&(!state.valid||clock.now()<state.expires))return state;
        try {
            String token=storage.token();
            state=token.isEmpty()?Reply.denied("Nhập key để kích hoạt KeyZone trên điện thoại."):validated(remote.request("verify",storage.device(),token));
        } catch(Exception error) { state=Reply.denied("Không kiểm tra được bản quyền. Kiểm tra Internet rồi thử lại."); }
        checked=clock.elapsed();return state;
    }
    synchronized Reply activate(String key) throws Exception {
        if(key==null||!key.trim().matches("[A-Za-z0-9-]{16,80}"))throw new Exception("Key cần 16–80 ký tự gồm chữ, số và dấu gạch ngang.");
        // A failed replacement must never leave an earlier entitlement cached.
        state=Reply.denied("Chưa kích hoạt.");checked=-1;
        Reply result;
        try { result=validated(remote.request("activate",storage.device(),key.trim().toUpperCase(java.util.Locale.ROOT))); }
        catch(Exception error) { throw new Exception("Không kết nối được máy chủ key. Kiểm tra Internet rồi thử lại."); }
        if(!result.valid) { state=result;checked=clock.elapsed();throw new Denied(result.error); }
        if(!result.token.matches("[a-f0-9]{64}"))throw new Exception("Máy chủ trả về phiên kích hoạt không hợp lệ.");
        storage.token(result.token);state=result;checked=clock.elapsed();return state;
    }
    synchronized void deactivate() throws Exception {
        String token=storage.token();
        if(!token.isEmpty())remote.request("deactivate",storage.device(),token);
        storage.token("");state=Reply.denied("Đã gỡ kích hoạt trên điện thoại này.");checked=-1;
    }
    void requireValid(boolean force) throws Denied {
        Reply reply=status(force);if(!reply.valid)throw new Denied(reply.error);
    }
    private Reply validated(Reply reply) {
        if(!reply.valid)return Reply.denied(reply.error.isEmpty()?"Key không còn hiệu lực.":reply.error);
        if(reply.expires<=clock.now())return Reply.denied("Key đã hết hạn.");
        return reply;
    }
}
